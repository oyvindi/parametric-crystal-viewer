import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { generateCrystal, type CrystalGeometry } from "@crystal/core";
import { createTerracedFluoriteDisplayGeometry, createThreeDisplayGrowthGeometry, type DisplayGrowthGeometry, type DisplayGrowthComponent } from "../display-growth.js";
import { inspectUnionTopology, unionTerracedCube } from "./box-union.js";

const bytes = (a: ArrayBufferView): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
function cube(scale = 1): CrystalGeometry {
    const result = generateCrystal({ crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" }, { morphologyScale: scale, forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] });
    if (result.status !== "valid") throw new Error("Expected cube");
    return result.geometry;
}
function display(components: readonly DisplayGrowthComponent[]): DisplayGrowthGeometry {
    return { components, positions: new Float64Array(components.flatMap(c => [...c.positions])), triangleFaces: new Uint32Array(components.flatMap(c => [...c.triangleFaces])) };
}
function fixture(): { core: CrystalGeometry; base: DisplayGrowthComponent; child: (min: number[], max: number[], axis?: number, sign?: number) => DisplayGrowthComponent } {
    const core = cube(); const base = createTerracedFluoriteDisplayGeometry(core).components[0]!;
    return { core, base, child: (min, max, axis = 0, sign = 1) => ({
        positions: Float64Array.from(base.positions, (v, i) => min[i % 3]! + (v - core.bounds.min[i % 3]!) / 2 * (max[i % 3]! - min[i % 3]!)),
        triangleFaces: new Uint32Array(12).fill(core.faces.findIndex(f => Math.abs(f.normal[axis]! - sign) < 1e-12)),
    }) };
}
function success(core: CrystalGeometry, input: DisplayGrowthGeometry) {
    const result = unionTerracedCube(core, input);
    if (result.status !== "valid") throw new Error(JSON.stringify(result.diagnostic));
    return result;
}
function bounds(component: DisplayGrowthComponent): { min: number[]; max: number[] } {
    return { min: [0, 1, 2].map(a => Math.min(...component.positions.filter((_, i) => i % 3 === a))), max: [0, 1, 2].map(a => Math.max(...component.positions.filter((_, i) => i % 3 === a))) };
}
// Independent occupancy-cell oracle for small analytic fixtures, not production clipping.
function measures(components: readonly DisplayGrowthComponent[]) {
    const boxes = components.map(bounds);
    const axes = [0, 1, 2].map(a => [...new Set(boxes.flatMap(b => [b.min[a]!, b.max[a]!]))].sort((a, b) => a - b));
    const occupied = (p: number[]) => boxes.some(b => p.every((v, a) => v > b.min[a]! && v < b.max[a]!));
    let volume = 0; let area = 0;
    for (let x = 0; x < axes[0]!.length - 1; x++) for (let y = 0; y < axes[1]!.length - 1; y++) for (let z = 0; z < axes[2]!.length - 1; z++) {
        const indices = [x, y, z]; const lo = indices.map((i, a) => axes[a]![i]!); const hi = indices.map((i, a) => axes[a]![i + 1]!);
        const mid = lo.map((v, a) => (v + hi[a]!) / 2); if (!occupied(mid)) continue;
        const width = hi.map((v, a) => v - lo[a]!); volume += width[0]! * width[1]! * width[2]!;
        for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
            const probe = [...mid]; probe[a] = (s < 0 ? lo[a]! : hi[a]!) + s * 1e-7;
            if (!occupied(probe)) area += width[(a + 1) % 3]! * width[(a + 2) % 3]!;
        }
    }
    return { area, volume };
}
function meshArea(component: DisplayGrowthComponent): number {
    let area = 0;
    for (let i = 0; i < component.positions.length; i += 9) {
        const a = [0, 1, 2].map(j => component.positions[i + 3 + j]! - component.positions[i + j]!);
        const b = [0, 1, 2].map(j => component.positions[i + 6 + j]! - component.positions[i + j]!);
        area += Math.hypot(a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!) / 2;
    }
    return area;
}

it("matches independent area and volume for buried, duplicate, overlapping, touching and cross-edge arrangements", () => {
    const { core, base, child } = fixture();
    const cases = [
        [],
        [child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5])],
        [child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5]), child([2.75, 1.75, 1.75], [3.25, 2.25, 2.25])],
        [child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5]), child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5])],
        [child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5]), child([2.5, 2, 1.5], [3.75, 2.75, 2.5])],
        [child([2.5, 1, 1.5], [3.5, 2, 2.5]), child([2.5, 2, 1.5], [3.75, 3, 2.5])],
        [child([2.5, 2, 1.5], [3.5, 3, 2.5]), child([2, 2.5, 1.75], [3, 3.75, 2.75], 1)],
        [child([2.5, 2, 2], [3.5, 3, 3]), child([2, 2.5, 2], [3, 3.75, 3], 1), child([2, 2, 2.5], [3, 3, 3.25], 2)],
    ];
    for (const children of cases) {
        const operands = [base, ...children]; const result = success(core, display(operands));
        const expected = measures(operands);
        expect(inspectUnionTopology(result.geometry, 6).volume).toBeCloseTo(expected.volume, 10);
        expect(meshArea(result.geometry)).toBeCloseTo(expected.area, 10);
        expect(result.geometry.components).toHaveLength(1);
        const reordered = success(core, display([base, ...children.slice().reverse()]));
        expect(bytes(reordered.geometry.positions)).toEqual(bytes(result.geometry.positions));
        expect(bytes(reordered.geometry.triangleFaces)).toEqual(bytes(result.geometry.triangleFaces));
    }
});

it("retains source provenance on every split and emits only exterior triangles", () => {
    const { core, base, child } = fixture();
    const input = display([base, child([2.5, 1.5, 1.5], [3.5, 3, 2.5]), child([2, 2.5, 1.75], [3, 3.75, 2.75], 1)]);
    const boxes = input.components.map(bounds); const output = success(core, input).geometry;
    for (let i = 0; i < output.positions.length; i += 9) {
        const points = [0, 3, 6].map(offset => [...output.positions.slice(i + offset, i + offset + 3)]);
        const mid = [0, 1, 2].map(a => points.reduce((sum, p) => sum + p[a]! / 3, 0));
        const axis = [0, 1, 2].find(a => points.every(p => p[a] === points[0]![a]))!;
        const a = points[1]!.map((v, j) => v - points[0]![j]!); const b = points[2]!.map((v, j) => v - points[0]![j]!);
        const sign = Math.sign(a[(axis + 1) % 3]! * b[(axis + 2) % 3]! - a[(axis + 2) % 3]! * b[(axis + 1) % 3]!);
        const inside = (delta: number) => boxes.some(box => mid.every((v, j) => { const x = v + (j === axis ? delta * sign : 0); return x > box.min[j]! && x < box.max[j]!; }));
        expect(inside(-1e-7)).toBe(true); expect(inside(1e-7)).toBe(false);
        const face = output.triangleFaces[i / 9]!;
        expect(input.components.some((component, j) => component.triangleFaces.includes(face) && points.every(p => p.every((v, k) => v >= boxes[j]!.min[k]! && v <= boxes[j]!.max[k]!)) && mid[axis] === (sign > 0 ? boxes[j]!.max[axis] : boxes[j]!.min[axis]))).toBe(true);
    }
});

it("is byte deterministic and immutable for the accepted 486 children and reordered inputs", () => {
    const core = cube(); const input = createTerracedFluoriteDisplayGeometry(core);
    const coreBefore = structuredClone(core); const inputBefore = structuredClone(input);
    const first = success(core, input); const second = success(core, display([input.components[0]!, ...input.components.slice(1).reverse()]));
    expect(bytes(first.geometry.positions)).toEqual(bytes(second.geometry.positions));
    expect(bytes(first.geometry.triangleFaces)).toEqual(bytes(second.geometry.triangleFaces));
    expect(core).toEqual(coreBefore); expect(input).toEqual(inputBefore);
    const gpu = createThreeDisplayGrowthGeometry(first.geometry);
    expect([...gpu.getAttribute("surfaceProfile").array].every(v => v === 0)).toBe(true);
    gpu.center();
    const normalizedGpu = Float64Array.from(gpu.getAttribute("position").array, (v, i) => (v - core.bounds.min[i % 3]!) / 2);
    expect(() => inspectUnionTopology({ positions: normalizedGpu, triangleFaces: first.geometry.triangleFaces }, 6)).not.toThrow();
    gpu.dispose();
}, 20_000);

it("validates seed and scale samples without assuming all seeds will succeed", () => {
    for (const scale of [0.001, 1, 1000]) for (const seed of [0, 1, 2, 0xffff_ffff]) {
        const core = cube(scale); const input = createTerracedFluoriteDisplayGeometry(core, seed);
        expect(success(core, input).geometry.components).toHaveLength(1);
    }
}, 20_000);

it("rejects unsupported inputs without exposing partial geometry", () => {
    const { core, base, child } = fixture();
    const malformed = child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5]); malformed.positions[0]! += 0.01;
    const nan = structuredClone(base); nan.positions[0] = NaN;
    const provenance = child([2.5, 1.5, 1.5], [3.5, 2.5, 2.5]); provenance.triangleFaces[0] = 999;
    const cases: [DisplayGrowthComponent[], string][] = [
        [[base, child([2.5, 1.5, 1.5], [3.5, 3.1, 2.5])], "footprint"],
        [[base, child([3, 1.5, 1.5], [3.5, 2.5, 2.5])], "unsupported-input"],
        [[base, child([2.5, 1.5, 1.5], [3.5, 1.5 + 1e-10, 2.5])], "numerical"],
        [[base, malformed], "unsupported-input"], [[base, nan], "numerical"], [[base, provenance], "provenance"],
        [[base, child([2.5, 1, 1], [3.5, 2, 2]), child([2.5, 2, 2], [3.5, 3, 3])], "topology"],
        [Array(513).fill(base), "budget"],
    ];
    for (const [components, code] of cases) {
        const result = unionTerracedCube(core, display(components));
        expect(result.status).toBe("rejected"); expect(result).not.toHaveProperty("geometry");
        if (result.status === "rejected") expect(result.diagnostic.code).toBe(`three.display-union.${code}`);
    }
    const wrongCore = { ...core, faces: core.faces.map((face, i) => i === 0 ? { ...face, normal: [0.5, 0.5, 0] as const } : face) };
    expect(unionTerracedCube(wrongCore, display([base])).status).toBe("rejected");
});

it("detects missing and inverted triangles, disconnected shells and pinched vertex links", () => {
    const { base, child } = fixture();
    expect(() => inspectUnionTopology({ positions: base.positions.slice(9), triangleFaces: base.triangleFaces.slice(1) }, 6)).toThrow();
    const reversed = structuredClone(base); reversed.positions.set([...base.positions.slice(3, 6), ...base.positions.slice(0, 3)], 0);
    expect(() => inspectUnionTopology(reversed, 6)).toThrow();
    expect(() => inspectUnionTopology(display([base, child([4, 4, 4], [5, 5, 5])]), 6)).toThrow(/Disconnected/);
    expect(() => inspectUnionTopology(display([base, child([3, 3, 3], [4, 4, 4])]), 6)).toThrow();
});

it("keeps the spike renderer-neutral and outside the production entry point", () => {
    const source = readFileSync(new URL("./box-union.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^import(?! type)/m);
    expect(source).not.toMatch(/\b(?:window|document|THREE)\b/);
    expect(readFileSync(new URL("../index.ts", import.meta.url), "utf8")).not.toContain("experimental");
});

// A face-local maximum-height integral independently checks the complete field.
// Unlike rectangle subtraction, it samples the exact arrangement cells on each face.
it("matches the full pinned field's height-envelope volume and exterior area", () => {
    const core = cube(); const input = createTerracedFluoriteDisplayGeometry(core);
    let volume = 8; let area = 24;
    for (let face = 0; face < 6; face++) {
        const normal = core.faces[face]!.normal; const axis = normal.findIndex(v => Math.abs(v) > 0.5);
        const sign = Math.sign(normal[axis]!); const u = (axis + 1) % 3; const v = (axis + 2) % 3;
        const children = input.components.slice(1).filter(c => c.triangleFaces[0] === face).map(bounds);
        const plane = sign > 0 ? core.bounds.max[axis]! : core.bounds.min[axis]!;
        const cuts = [u, v].map(a => [...new Set([core.bounds.min[a]!, core.bounds.max[a]!, ...children.flatMap(b => [b.min[a]!, b.max[a]!])])].sort((a, b) => a - b));
        const nu = cuts[0]!.length - 1; const nv = cuts[1]!.length - 1;
        const heights = new Float64Array(nu * nv);
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
            const midU = (cuts[0]![i]! + cuts[0]![i + 1]!) / 2; const midV = (cuts[1]![j]! + cuts[1]![j + 1]!) / 2;
            let height = 0;
            for (const b of children) if (midU > b.min[u]! && midU < b.max[u]! && midV > b.min[v]! && midV < b.max[v]!) height = Math.max(height, sign * ((sign > 0 ? b.max[axis]! : b.min[axis]!) - plane));
            heights[i * nv + j] = height;
            const du = cuts[0]![i + 1]! - cuts[0]![i]!; const dv = cuts[1]![j + 1]! - cuts[1]![j]!;
            volume += height * du * dv;
            area += Math.abs(height - (i ? heights[(i - 1) * nv + j]! : 0)) * dv;
            area += Math.abs(height - (j ? heights[i * nv + j - 1]! : 0)) * du;
            if (i === nu - 1) area += height * dv;
            if (j === nv - 1) area += height * du;
        }
    }
    const output = success(core, input).geometry;
    expect(inspectUnionTopology(output, 6).volume).toBeCloseTo(volume, 8);
    expect(meshArea(output)).toBeCloseTo(area, 8);
}, 20_000);

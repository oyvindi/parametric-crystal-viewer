import { expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import { createTerracedFluoriteDisplayGeometry, createThreeDisplayGrowthGeometry, type DisplayGrowthComponent } from "./display-growth.js";
import { createCornerGrowthOperands } from "./corner-growth.js";
import { inspectUnionTopology, unionTerracedCube } from "./box-union.js";

function fixture(seed = 0x5f3759df, scale = 1) {
    const result = generateCrystal({ crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" }, { morphologyScale: scale, forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] });
    if (result.status !== "valid") throw new Error("Expected cube");
    const core = result.geometry;
    const accepted = createTerracedFluoriteDisplayGeometry(core, seed);
    return { core, accepted, extras: createCornerGrowthOperands(core, accepted, seed) };
}
const bytes = (a: ArrayBufferView): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const bounds = (component: DisplayGrowthComponent) => ({
    min: [0, 1, 2].map(a => Math.min(...component.positions.filter((_, i) => i % 3 === a))),
    max: [0, 1, 2].map(a => Math.max(...component.positions.filter((_, i) => i % 3 === a))),
});

it("adds 72 staggered edge blocks and 8 corner blocks with local heights and explicit face provenance", () => {
    const { core, accepted, extras } = fixture(); const side = 2;
    expect(extras).toHaveLength(80);
    const groups = new Map<number, { min: number; max: number }[]>();
    for (const [index, component] of extras.entries()) {
        inspectUnionTopology(component, 6);
        const b = bounds(component); const crossed = core.faces.map((face, id) => {
            const axis = face.normal.findIndex(v => Math.abs(v) > 0.5); const sign = Math.sign(face.normal[axis]!);
            const depth = sign > 0 ? b.max[axis]! - core.bounds.max[axis]! : core.bounds.min[axis]! - b.min[axis]!;
            return { id, axis, sign, depth };
        }).filter(f => f.depth > 1e-10);
        expect(crossed).toHaveLength(index < 72 ? 2 : 3);
        for (const face of crossed) {
            expect(face.depth / side).toBeLessThanOrEqual(0.06);
            const candidateHeights = accepted.components.slice(1).filter(c => c.triangleFaces[0] === face.id).map(bounds).map(box => face.sign > 0 ? box.max[face.axis]! : box.min[face.axis]!);
            const top = face.sign > 0 ? b.max[face.axis]! : b.min[face.axis]!;
            expect(candidateHeights.some(value => Math.abs(value - top) < 1e-12)).toBe(true);
        }
        for (let a = 0; a < 3; a++) {
            expect(b.max[a]! - b.min[a]!).toBeLessThanOrEqual(0.22 * side);
            expect(Math.min(b.max[a]!, core.bounds.max[a]!) - Math.max(b.min[a]!, core.bounds.min[a]!)).toBeGreaterThan(0);
            for (const sign of [-1, 1]) {
                const slot = a * 2 + (sign > 0 ? 1 : 0);
                const expected = crossed.find(f => f.axis === a && f.sign === sign)?.id ?? Math.min(...crossed.map(f => f.id));
                expect([...component.triangleFaces.slice(slot * 2, slot * 2 + 2)]).toEqual([expected, expected]);
            }
        }
        if (index < 72) {
            const along = [0, 1, 2].find(a => !crossed.some(f => f.axis === a))!;
            const group = Math.floor(index / 6);
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group)!.push({ min: b.min[along]!, max: b.max[along]! });
        }
    }
    expect(groups.size).toBe(12);
    for (const intervals of groups.values()) for (let i = 1; i < intervals.length; i++) expect(intervals[i]!.min - intervals[i - 1]!.max).toBeGreaterThan(0.015 * side);
});

it("regenerates byte-identically, preserves sources, and joins the new operands into a GPU-safe manifold", () => {
    const { core, accepted, extras } = fixture();
    const before = structuredClone({ core, accepted, extras });
    const reversed = { ...accepted, components: [accepted.components[0]!, ...accepted.components.slice(1).reverse()] };
    const again = createCornerGrowthOperands(core, reversed);
    extras.forEach((c, i) => { expect(bytes(c.positions)).toEqual(bytes(again[i]!.positions)); expect(bytes(c.triangleFaces)).toEqual(bytes(again[i]!.triangleFaces)); });
    const first = unionTerracedCube(core, accepted, extras);
    const second = unionTerracedCube(core, reversed, extras.slice().reverse());
    if (first.status !== "valid" || second.status !== "valid") throw new Error(JSON.stringify([first, second]));
    expect(first.geometry.components).toHaveLength(1);
    expect(bytes(first.geometry.positions)).toEqual(bytes(second.geometry.positions));
    expect(bytes(first.geometry.triangleFaces)).toEqual(bytes(second.geometry.triangleFaces));
    expect({ core, accepted, extras }).toEqual(before);
    // Outside two core planes, surfaces can originate only from the new operands.
    // Check actual surviving triangles against their attributed source rectangles.
    const sourceFaces = extras.flatMap(component => Array.from({ length: 6 }, (_, slot) => {
        const p = component.positions.slice(slot * 18, slot * 18 + 18);
        return { face: component.triangleFaces[slot * 2]!, axis: Math.floor(slot / 2), bounds: bounds({ positions: p, triangleFaces: new Uint32Array(2) }) };
    }));
    let checked = 0;
    for (let i = 0; i < first.geometry.positions.length; i += 9) {
        const points = [0, 3, 6].map(offset => [...first.geometry.positions.slice(i + offset, i + offset + 3)]);
        const mid = [0, 1, 2].map(a => points.reduce((sum, p) => sum + p[a]! / 3, 0));
        if (mid.filter((v, a) => v < core.bounds.min[a]! - 1e-10 || v > core.bounds.max[a]! + 1e-10).length < 2) continue;
        const face = first.geometry.triangleFaces[i / 9]!;
        expect(sourceFaces.some(source => source.face === face && points.every(p => p.every((v, a) => v >= source.bounds.min[a]! - 1e-12 && v <= source.bounds.max[a]! + 1e-12)))).toBe(true);
        checked++;
    }
    expect(checked).toBeGreaterThan(0);
    const gpu = createThreeDisplayGrowthGeometry(first.geometry); gpu.center();
    expect([...gpu.getAttribute("surfaceProfile").array].every(value => value === 0)).toBe(true);
    inspectUnionTopology({ positions: Float64Array.from(gpu.getAttribute("position").array, v => v / 2), triangleFaces: first.geometry.triangleFaces }, 6);
    gpu.dispose();
}, 20_000);

it("rejects cross-face operands in the original path and rejects invalid experimental attribution or size", () => {
    const { core, accepted, extras } = fixture();
    expect(unionTerracedCube(core, { ...accepted, components: [accepted.components[0]!, extras[0]!] }).status).toBe("rejected");
    const wrong = structuredClone(extras[0]!); wrong.triangleFaces.fill(99);
    const oversized = structuredClone(extras[0]!);
    for (let i = 0; i < oversized.positions.length; i++) oversized.positions[i] = core.bounds.min[i % 3]! + (oversized.positions[i]! - core.bounds.min[i % 3]!) * 2;
    for (const operands of [[wrong], [oversized], Array(129).fill(extras[0])]) {
        const result = unionTerracedCube(core, accepted, operands);
        expect(result.status).toBe("rejected"); expect(result).not.toHaveProperty("geometry");
    }
});

it("retains topology over sampled seeds and scales and varies placement with the seed", () => {
    const one = fixture(1); const two = fixture(2);
    expect(bytes(one.extras[0]!.positions)).not.toEqual(bytes(two.extras[0]!.positions));
    for (const seed of [0, 1, 2, 0xffff_ffff]) for (const scale of [0.001, 1, 1000]) {
        const { core, accepted, extras } = fixture(seed, scale);
        const result = unionTerracedCube(core, accepted, extras);
        if (result.status !== "valid") throw new Error(`${seed}/${scale}: ${JSON.stringify(result.diagnostic)}`);
        const gpu = createThreeDisplayGrowthGeometry(result.geometry); gpu.center();
        const checkGpu = () => inspectUnionTopology({ positions: Float64Array.from(gpu.getAttribute("position").array, v => v / (scale * 2)), triangleFaces: result.geometry.triangleFaces }, 6);
        // Float64 centering before Float32 conversion preserves thin triangle
        // separations at small morphology scales.
        expect(checkGpu).not.toThrow();
        gpu.dispose();
    }
}, 20_000);

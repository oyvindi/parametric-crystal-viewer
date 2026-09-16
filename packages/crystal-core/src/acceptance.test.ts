import { describe, it, expect } from "vitest";
import { applySpaceOperation, createLattice, generateCrystal, intersectHalfSpaces, getPointOperationRegistryEntry, validatePointOperations, validateSpaceOperations, expandEquivalentPlaneDirections, removeCollinearVertices, TOLERANCES as T, type HalfSpace, type Vec3, type Mat3, type GeometryResult, type Crystallography } from "./index.js";

const cell = { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 };
const crystal: Crystallography = { crystalSystem: "cubic", unitCell: cell, pointGroup: "m-3m", setting: "cubic-standard" };
const cube = { id: "cube", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 1 };
const identity: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const normals: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const box = (distance = 1): HalfSpace[] => normals.map((normal, i) => ({ id: `p${i}`, normal, distance }));
function valid(result: GeometryResult) { expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid"); if (result.status !== "valid") throw Error("Invalid fixture"); return result.geometry; }
const codes = (result: GeometryResult) => result.diagnostics.map((d) => d.code);
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe("M1 public contract", () => {
    it("generates a centered cube with oriented indices and all originating operations", () => {
        const geometry = valid(generateCrystal(crystal, { forms: [cube] }));
        expect(geometry.vertices).toBeInstanceOf(Float64Array);
        geometry.bounds.min.forEach((x) => expect(x).toBeCloseTo(1, 12));
        geometry.bounds.max.forEach((x) => expect(x).toBeCloseTo(3, 12));
        for (const face of geometry.faces) {
            expect(face.symmetryGroup).toBe("m-3m");
            expect(face.contributors).toHaveLength(1);
            expect(face.contributors[0]!.operationIds).toHaveLength(8);
            expect(face.contributors[0]!.indices?.notation).toBe("miller");
        }
    });
    it("matches explicit symmetry and unit-converted geometry", () => {
        const registry = generateCrystal(crystal, { forms: [cube] });
        const explicit = generateCrystal({ ...crystal, pointOperations: getPointOperationRegistryEntry("point-group:m-3m:standard")!.operations }, { forms: [cube] });
        expect(explicit).toEqual(registry);
        expect(generateCrystal({ ...crystal, unitCell: { ...cell, a: 0.4, b: 0.4, c: 0.4, lengthUnit: "nanometre" } }, { forms: [cube] })).toEqual(registry);
    });
    it("omits disabled/zero forms, recovers after invalid input, and reports safe independent issues", () => {
        expect(codes(generateCrystal(crystal, { forms: [{ ...cube, enabled: false }] }))).toEqual(["core.geometry.no-active-forms"]);
        expect(codes(generateCrystal(crystal, { forms: [{ ...cube, development: 0 }] }))).toEqual(["core.geometry.no-active-forms"]);
        const bad = generateCrystal({ ...crystal, unitCell: { ...cell, a: NaN, beta: Infinity } }, { morphologyScale: -1, forms: [{ ...cube, development: -1, indices: { notation: "miller", h: 0, k: 0, l: 0 } }] });
        expect(bad.diagnostics.map((d) => d.path)).toEqual(["/crystallography/unitCell/a", "/crystallography/unitCell/beta", "/morphologyScale", "/forms/0/development", "/forms/0/indices/"]);
        expect(JSON.parse(JSON.stringify(bad))).toEqual(bad);
        valid(generateCrystal(crystal, { forms: [cube] }));
    });
    it.each([NaN, Infinity, -Infinity, -0.1, 1.1, Number.MIN_VALUE])("rejects invalid development %s before intersection", (development) => {
        expect(codes(generateCrystal(crystal, { forms: [{ ...cube, development }] }))).toContain("core.input.invalid-development");
    });
    it("rejects duplicate form IDs and non-finite indices and operations", () => {
        expect(codes(generateCrystal(crystal, { forms: [cube, cube] }))).toContain("core.input.invalid-form");
        expect(codes(generateCrystal(crystal, { forms: [{ ...cube, indices: { ...cube.indices, h: Infinity } }] }))).toContain("core.input.invalid-miller-indices");
        expect(codes(generateCrystal({ ...crystal, pointGroup: undefined, pointOperations: [{ id: "bad", linear: [[NaN, 0, 0], [0, 1, 0], [0, 0, 1]] }] }, { forms: [cube] }))).toContain("core.symmetry.invalid-operation");
    });
    it("requires symmetry and setting agreement without inventing opposite faces", () => {
        const explicit = { ...crystal, pointGroup: undefined, setting: undefined };
        expect(codes(generateCrystal(explicit, { forms: [cube] }))).toContain("core.symmetry.missing");
        expect(codes(generateCrystal({ ...explicit, identityOnly: true }, { forms: [cube] }))).toEqual(["core.geometry.unbounded"]);
        expect(codes(generateCrystal({ ...crystal, setting: undefined }, { forms: [cube] }))).toContain("core.symmetry.unsupported-registry");
        expect(codes(generateCrystal({ ...crystal, pointOperations: [{ id: "e", linear: identity }] }, { forms: [cube] }))).toContain("core.symmetry.conflicting-descriptions");
    });
    it.each([1e-6, 1, 1e6])("preserves topology and attribution at morphology scale %s", (scale) => {
        const base = valid(generateCrystal(crystal, { forms: [cube] }));
        const scaled = valid(generateCrystal(crystal, { forms: [cube], morphologyScale: scale }));
        expect(scaled.faces).toEqual(base.faces);
        scaled.vertices.forEach((x, i) => expect((x - 2) / scale).toBeCloseTo(base.vertices[i]! - 2, 8));
    });
    it("reports numerical failure for finite but unrepresentable output", () => {
        expect(codes(generateCrystal(crystal, { forms: [cube], morphologyScale: Number.MIN_VALUE }))).toEqual(["core.geometry.numerical-failure"]);
        expect(codes(generateCrystal(crystal, { forms: [{ ...cube, development: 0.5 }], morphologyScale: Number.MAX_VALUE }))).toEqual(["core.geometry.numerical-failure"]);
    });
    it("updates ties and controlling forms, preserving requested settings", () => {
        const tied = { ...cube, id: "other" };
        const first = generateCrystal(crystal, { forms: [cube, tied] });
        const g = valid(first);
        expect(g.faces.every((f) => f.contributors.length === 2)).toBe(true);
        expect(generateCrystal(crystal, { forms: [tied, cube] })).toEqual(first);
        const changed = generateCrystal(crystal, { forms: [cube, { ...tied, development: 0.5 }] });
        expect(valid(changed).vertices).toEqual(g.vertices);
        expect(valid(changed).faces.every((f) => f.contributors[0]?.formId === "cube" && f.contributors.length === 1)).toBe(true);
        expect(changed.diagnostics).toMatchObject([{ code: "core.geometry.redundant-form", severity: "warning", formIds: ["other"] }]);
        expect(valid(generateCrystal(crystal, { forms: [{ ...cube, development: 0.5 }, tied] })).faces.every((f) => f.contributors[0]?.formId === "other")).toBe(true);
        expect(tied.development).toBe(1);
    });
});

describe("M1 intersection and tolerance acceptance", () => {
    it("distinguishes open prisms, capped prisms, and unbounded shapes with four or more vertices", () => {
        expect(codes(intersectHalfSpaces(box().slice(0, 4)))).toEqual(["core.geometry.unbounded"]);
        valid(intersectHalfSpaces(box()));
        expect(codes(intersectHalfSpaces(box().slice(0, 5)))).toEqual(["core.geometry.unbounded"]);
        expect(codes(intersectHalfSpaces([{ id: "a", normal: [1, 1, 1], distance: 1 }]))).toEqual(["core.geometry.unbounded"]);
    });
    it("reconstructs octahedral polygons with outward winding and closed edge incidence", () => {
        const planes: HalfSpace[] = [];
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) planes.push({ id: `${x},${y},${z}`, normal: [x, y, z], distance: 1 });
        const g = valid(intersectHalfSpaces(planes));
        expect(g.vertices).toHaveLength(18); expect(g.faces).toHaveLength(8);
        for (const face of g.faces) {
            expect(new Set(face.vertexIndices).size).toBe(3);
            const points = face.vertexIndices.map((i) => [...g.vertices.slice(i * 3, i * 3 + 3)] as unknown as Vec3);
            expect(dot(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)), face.normal)).toBeGreaterThan(0);
        }
        expect(intersectHalfSpaces([...planes].reverse())).toEqual(intersectHalfSpaces(planes));
    });
    it("removes redundant oblique and parallel planes and groups duplicate operation IDs by form", () => {
        const planes = [...box(), { id: "outside", normal: [1, 1, 1] as Vec3, distance: 4 }, { id: "tie", normal: [1, 0, 0] as Vec3, distance: 1, contributors: [{ formId: "f", operationIds: ["b", "a"] }, { formId: "f", operationIds: ["a"] }] }];
        const g = valid(intersectHalfSpaces(planes));
        expect(g.faces).toHaveLength(6);
        expect(g.faces.find((f) => f.normal[0] === 1)!.contributors).toEqual([{ formId: "f", operationIds: ["a", "b"] }]);
        expect(intersectHalfSpaces([...planes].reverse())).toEqual(intersectHalfSpaces(planes));
    });
    it("uses the true minimum support and does not chain distance tolerance ties", () => {
        const constraints = [0, 0.75, 1.5].map((offset, i): HalfSpace => ({ id: `tie${i}`, normal: [1, 0, 0], distance: 1 + offset * T.plane, contributors: [{ formId: `f${i}`, operationIds: ["e"] }] }));
        const result = intersectHalfSpaces([...box(), ...constraints]);
        const g = valid(result);
        expect(g.bounds.max[0]).toBe(1);
        expect(g.faces.find((f) => f.normal[0] === 1)!.contributors.map((c) => c.formId)).toEqual(["f0", "f1"]);
        expect(intersectHalfSpaces([...constraints].reverse().concat(box().reverse()))).toEqual(result);
    });
    it("distinguishes near but different directions rather than using dot-product angular loss", () => {
        const g = valid(intersectHalfSpaces([...box(), { id: "tilt", normal: [1, 1e-4, 0], distance: 1 }]));
        expect(g.faces).toHaveLength(7);
    });
    it("removes collinear loop points while preserving corners", () => {
        expect(removeCollinearVertices([0, 1, 2, 3, 4], [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0]])).toEqual([0, 2, 3, 4]);
        expect(removeCollinearVertices([0, 1, 2, 3, 4], [[0, 0, 0], [1, -1e-5, 0], [2, 0, 0], [2, 1, 0], [0, 1, 0]])).toHaveLength(5);
    });
    it("classifies zero-volume and poorly conditioned bounded intersections separately", () => {
        expect(codes(intersectHalfSpaces(box().map((p, i) => ({ ...p, distance: i >= 4 ? 0 : 1 }))))).toEqual(["core.geometry.degenerate"]);
        expect(codes(intersectHalfSpaces(box().map((p, i) => ({ ...p, distance: i >= 4 ? 1e8 : 1 }))))).toEqual(["core.geometry.degenerate"]);
        expect(codes(intersectHalfSpaces(box(1e200)))).toEqual(["core.geometry.numerical-failure"]);
        valid(intersectHalfSpaces(box().map((p, i) => ({ ...p, distance: i >= 4 ? 1e3 : 1 }))));
    });
    it("rejects all safely determinable invalid planes without a partial mesh", () => {
        const r = intersectHalfSpaces([{ id: "nan", normal: [NaN, 0, 0], distance: 1 }, { id: "inf", normal: [1, 0, 0], distance: Infinity }]);
        expect(r.diagnostics).toHaveLength(2); expect(r).not.toHaveProperty("geometry");
    });
});

describe("M1 lattice and affine symmetry acceptance", () => {
    it.each([[3, 4, 5, 90, 90, 90], [3, 4, 5, 90, 110, 90], [4, 5, 6, 70, 80, 75]])("reproduces metric, volume and reciprocal products for %j", (a, b, c, alpha, beta, gamma) => {
        const result = createLattice({ a, b, c, alpha, beta, gamma });
        if (!result.ok) throw Error("Invalid fixture");
        const { direct: l, reciprocal: r, metric: g, volume } = result.value;
        const [ca, cb, cg] = [alpha, beta, gamma].map((x) => Math.cos(x * Math.PI / 180));
        expect(volume).toBeCloseTo(a * b * c * Math.sqrt(1 + 2 * ca! * cb! * cg! - ca! ** 2 - cb! ** 2 - cg! ** 2), 10);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            expect(l.reduce((sum, row, k) => sum + row[i]! * r[k]![j]!, 0)).toBeCloseTo(i === j ? 1 : 0, 12);
            expect(l.reduce((sum, row) => sum + row[i]! * row[j]!, 0)).toBeCloseTo(g[i]![j]!, 12);
        }
        const x: Vec3 = [0.25, -0.5, 2], y: Vec3 = [1, 0.75, -0.25];
        const cart = (v: Vec3) => l.map((row) => dot(row, v)) as unknown as Vec3;
        expect(dot(cart(x), cart(y))).toBeCloseTo(dot(x, g.map((row) => dot(row, y)) as unknown as Vec3), 12);
    });
    it("validates inverse-transpose behavior in a non-orthogonal hexagonal basis", () => {
        const lattice = createLattice({ a: 1, b: 1, c: 2, alpha: 90, beta: 90, gamma: 120 });
        if (!lattice.ok) throw Error("Invalid fixture");
        const w: Mat3 = [[0, -1, 0], [1, -1, 0], [0, 0, 1]];
        const w2: Mat3 = [[-1, 1, 0], [-1, 0, 0], [0, 0, 1]];
        const ops = [{ id: "e", linear: identity }, { id: "r", linear: w }, { id: "r2", linear: w2 }];
        expect(validatePointOperations(ops, lattice.value).ok).toBe(true);
        const result = expandEquivalentPlaneDirections(cube.indices, ops, lattice.value);
        if (!result.ok) throw Error("Invalid directions");
        expect(result.value.map((p) => [p.indices.h, p.indices.k, p.indices.l])).toEqual([[-1, 1, 0], [0, -1, 0], [1, 0, 0]]);
        expect(result.value).toHaveLength(3);
        expect(validatePointOperations(ops.slice(0, 2), lattice.value).diagnostics.map((d) => d.code)).toContain("core.symmetry.missing-inverse");
    });
    it("tests closure independently from inverses and identity", () => {
        const lattice = createLattice(cell); if (!lattice.ok) throw Error("Invalid fixture");
        const x: Mat3 = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
        const y: Mat3 = [[1, 0, 0], [0, -1, 0], [0, 0, 1]];
        expect(validatePointOperations([{ id: "e", linear: identity }, { id: "x", linear: x }, { id: "y", linear: y }], lattice.value).diagnostics.map((d) => d.code)).toEqual(["core.symmetry.not-closed", "core.symmetry.not-closed"]);
        expect(validatePointOperations([{ id: "x", linear: x }], lattice.value).diagnostics.map((d) => d.code)).toContain("core.symmetry.missing-identity");
    });
    it("uses metric-relative symmetry tolerances across cell sizes", () => {
        for (const a of [1e-4, 1e4]) {
            const lattice = createLattice({ ...cell, a, b: a, c: a }); if (!lattice.ok) throw Error("Invalid fixture");
            expect(validatePointOperations(getPointOperationRegistryEntry("point-group:m-3m:standard")!.operations, lattice.value).ok).toBe(true);
        }
    });
    it("validates fractional translations modulo the lattice, with no effect on face directions", () => {
        const lattice = createLattice(cell); if (!lattice.ok) throw Error("Invalid fixture");
        const space = [{ id: "e", linear: identity, translation: [0, 0, 0] as Vec3 }, { id: "t", linear: identity, translation: [0.5, 0, 0] as Vec3 }];
        expect(validateSpaceOperations(space, lattice.value).ok).toBe(true);
        expect(applySpaceOperation(space[1]!, [0.1, 0.2, 0.3])).toEqual({ ok: true, value: [0.6, 0.2, 0.3], diagnostics: [] });
        const forms = normals.map((n, i) => ({ id: `f${i}`, indices: { notation: "miller" as const, h: n[0], k: n[1], l: n[2] }, development: 1 }));
        const explicit: Crystallography = { crystalSystem: "cubic", unitCell: cell, spaceOperations: space };
        expect(generateCrystal(explicit, { forms })).toEqual(generateCrystal({ ...explicit, spaceOperations: undefined, pointOperations: [{ id: "e", linear: identity }] }, { forms }));
        expect(validateSpaceOperations([{ ...space[0]!, translation: [0.2, 0, 0] }], lattice.value).ok).toBe(false);
        expect(validateSpaceOperations([space[0]!, { ...space[1]!, translation: [0.3, 0, 0] }], lattice.value).ok).toBe(false);
        expect(validateSpaceOperations([space[0]!, { ...space[1]!, translation: [Infinity, 0, 0] }], lattice.value).ok).toBe(false);
    });
});

it("reports uncertainty near the matrix rank threshold instead of inventing a bounded solid", () => {
    const normals: Vec3[] = [[1, 0, 0], [0, 1, 0], [-1, -1, T.matrix / 10]];
    const planes = normals.flatMap((normal, i): HalfSpace[] => [{ id: `a${i}`, normal, distance: 1 }, { id: `b${i}`, normal: normal.map((x) => -x) as unknown as Vec3, distance: 1 }]);
    expect(codes(intersectHalfSpaces(planes))).toEqual(["core.geometry.numerical-failure"]);
});
it("keeps distinct vertices above the merge tolerance on a shallow corner cut", () => {
    const geometry = valid(intersectHalfSpaces([...box(), { id: "cut", normal: [1, 1, 1], distance: 3 - T.vertex * 100 }]));
    expect(geometry.faces).toHaveLength(7);
    expect(geometry.vertices).toHaveLength(30);
});

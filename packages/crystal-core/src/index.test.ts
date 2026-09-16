import { describe, expect, it } from "vitest";

import { createLattice, expandEquivalentPlaneDirections, generateCrystalGeometry, getPointOperationRegistryEntry, intersectHalfSpaces, resolvePointOperations, transformMillerIndices, validateMillerIndices, validatePointOperations } from "./index.js";

function assertMatrixClose(
    actual: readonly (readonly number[])[],
    expected: readonly (readonly number[])[],
    tolerance = 1e-12,
): void {
    for (let row = 0; row < expected.length; row += 1) {
        for (let column = 0; column < expected[row]!.length; column += 1) {
            expect(actual[row]![column]!).toBeCloseTo(expected[row]![column]!, Math.abs(Math.log10(tolerance)));
        }
    }
}

describe("crystal-core", () => {
    it("loads without browser globals", () => {
        expect(typeof globalThis.window).toBe("undefined");
        expect(typeof globalThis.document).toBe("undefined");
    });

it("constructs the direct and reciprocal bases of a cubic cell", () => {
    const result = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assertMatrixClose(result.value.direct, [[4, 0, 0], [0, 4, 0], [0, 0, 4]]);
    assertMatrixClose(result.value.reciprocal, [[0.25, 0, 0], [0, 0.25, 0], [0, 0, 0.25]]);
    expect(result.value.volume).toBe(64);
});

it("preserves metric and reciprocal identities for a triclinic cell", () => {
    const result = createLattice({ a: 4, b: 5, c: 6, alpha: 70, beta: 80, gamma: 75 });
    if (!result.ok) throw new Error("Expected valid triclinic lattice");
    expect(result.value.volume).toBeGreaterThan(0);
    const direct = result.value.direct;
    const reciprocal = result.value.reciprocal;
    const product = (column: number, reciprocalColumn: number) => direct[0][column] * reciprocal[0][reciprocalColumn] + direct[1][column] * reciprocal[1][reciprocalColumn] + direct[2][column] * reciprocal[2][reciprocalColumn];
    for (let column = 0; column < 3; column += 1) for (let row = 0; row < 3; row += 1) expect(product(column, row)).toBeCloseTo(column === row ? 1 : 0, 12);
});

it("normalizes supported nanometre cell lengths to Ångström", () => {
    const angstrom = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    const nanometre = createLattice({ a: 0.4, b: 0.4, c: 0.4, alpha: 90, beta: 90, gamma: 90, lengthUnit: "nanometre" });
    expect(nanometre).toEqual(angstrom);
});

it("rejects impossible and degenerate cells with a diagnostic", () => {
    const result = createLattice({ a: 1, b: 1, c: 1, alpha: 1, beta: 1, gamma: 179 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("core.input.invalid-unit-cell");
});

it("rejects non-finite dimensions and invalid angles", () => {
    expect(createLattice({ a: Number.NaN, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 }))
        .toMatchObject({ ok: false, diagnostics: [{ code: "core.input.invalid-unit-cell", path: "/a" }] });
    expect(createLattice({ a: 1, b: 1, c: 1, alpha: 90, beta: 180, gamma: 90 }))
        .toMatchObject({ ok: false, diagnostics: [{ code: "core.input.invalid-unit-cell", path: "/beta" }] });
});

it("reduces Miller indices without reversing their orientation", () => {
    const positive = validateMillerIndices({ notation: "miller", h: 2, k: 4, l: 6 });
    const negative = validateMillerIndices({ notation: "miller", h: -2, k: -4, l: -6 });
    expect(positive).toEqual({ ok: true, value: { notation: "miller", h: 1, k: 2, l: 3 }, diagnostics: [] });
    expect(negative).toEqual({ ok: true, value: { notation: "miller", h: -1, k: -2, l: -3 }, diagnostics: [] });
});

it("validates Miller–Bravais notation and its crystal-system constraint", () => {
    const valid = validateMillerIndices(
        { notation: "miller-bravais", h: 2, k: 2, i: -4, l: 6 },
        { crystalSystem: "hexagonal" },
    );
    expect(valid).toEqual({
        ok: true,
        value: { notation: "miller-bravais", h: 1, k: 1, i: -2, l: 3 },
        diagnostics: [],
    });
    const invalid = validateMillerIndices(
        { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 },
        { crystalSystem: "cubic" },
    );
    expect(invalid.ok).toBe(false);
});

it("transforms Miller columns by inverse transpose", () => {
    const transformed = transformMillerIndices(
        { notation: "miller", h: 1, k: 0, l: 0 },
        [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    );
    expect(transformed).toEqual({ ok: true, value: { notation: "miller", h: 0, k: 1, l: 0 }, diagnostics: [] });
});

it("validates a metric-compatible closed point-operation set", () => {
    const lattice = createLattice({ a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const result = validatePointOperations([
        { id: "identity", linear: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
        { id: "inversion", linear: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]] },
    ], lattice.value);
    expect(result.ok).toBe(true);
});

it("rejects operations incompatible with the cell metric", () => {
    const lattice = createLattice({ a: 2, b: 3, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid orthorhombic lattice");
    const result = validatePointOperations([
        { id: "identity", linear: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
        { id: "swap-a-b", linear: [[0, 1, 0], [1, 0, 0], [0, 0, 1]] },
    ], lattice.value);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "core.symmetry.metric-incompatible" }] });
});

it("resolves the cubic registry and matching explicit operations equivalently", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const entry = getPointOperationRegistryEntry("point-group:m-3m:standard");
    expect(entry?.operations).toHaveLength(48);
    const registry = resolvePointOperations({ registryId: "point-group:m-3m:standard" }, lattice.value);
    const explicit = resolvePointOperations({ operations: entry?.operations }, lattice.value);
    expect(registry).toEqual(explicit);
});

it("rejects missing and conflicting symmetry descriptions", () => {
    const lattice = createLattice({ a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    expect(resolvePointOperations({}, lattice.value)).toMatchObject({ ok: false, diagnostics: [{ code: "core.symmetry.missing" }] });
    expect(resolvePointOperations({ identityOnly: true, registryId: "point-group:m-3m:standard" }, lattice.value))
        .toMatchObject({ ok: false, diagnostics: [{ code: "core.symmetry.conflicting-descriptions" }] });
    expect(resolvePointOperations({ registryId: "unknown" }, lattice.value))
        .toMatchObject({ ok: false, diagnostics: [{ code: "core.symmetry.unsupported-registry" }] });
});

it("expands cubic {100} into six oriented plane directions", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const symmetry = resolvePointOperations({ registryId: "point-group:m-3m:standard" }, lattice.value);
    if (!symmetry.ok) throw new Error("Expected valid cubic symmetry");
    const planes = expandEquivalentPlaneDirections({ notation: "miller", h: 1, k: 0, l: 0 }, symmetry.value, lattice.value);
    expect(planes.ok).toBe(true);
    if (!planes.ok) return;
    expect(planes.value).toHaveLength(6);
    expect(planes.value.map((plane) => plane.indices)).toContainEqual({ notation: "miller", h: -1, k: 0, l: 0 });
});

it("intersects six enclosing planes into a cube", () => {
    const result = intersectHalfSpaces([
        { id: "+x", normal: [1, 0, 0], distance: 1 }, { id: "-x", normal: [-1, 0, 0], distance: 1 },
        { id: "+y", normal: [0, 1, 0], distance: 1 }, { id: "-y", normal: [0, -1, 0], distance: 1 },
        { id: "+z", normal: [0, 0, 1], distance: 1 }, { id: "-z", normal: [0, 0, -1], distance: 1 },
    ]);
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.geometry.vertices).toHaveLength(24);
    expect(result.geometry.faces).toHaveLength(6);
    expect(result.geometry.faces.every((face) => face.vertexIndices.length === 4)).toBe(true);
    expect(result.geometry.bounds).toEqual({ min: [-1, -1, -1], max: [1, 1, 1] });
});

it("reports an unbounded prism", () => {
    const result = intersectHalfSpaces([
        { id: "+x", normal: [1, 0, 0], distance: 1 }, { id: "-x", normal: [-1, 0, 0], distance: 1 },
        { id: "+y", normal: [0, 1, 0], distance: 1 }, { id: "-y", normal: [0, -1, 0], distance: 1 },
    ]);
    expect(result).toMatchObject({ status: "invalid", diagnostics: [{ code: "core.geometry.unbounded" }] });
});

it("retains contributors for coincident constraints and excludes looser duplicates", () => {
    const result = intersectHalfSpaces([
        { id: "+x-tight", normal: [1, 0, 0], distance: 1, contributors: [{ formId: "tight", operationIds: ["a"] }] },
        { id: "+x-tie", normal: [1, 0, 0], distance: 1, contributors: [{ formId: "tie", operationIds: ["b"] }] },
        { id: "+x-loose", normal: [1, 0, 0], distance: 2, contributors: [{ formId: "loose", operationIds: ["c"] }] },
        { id: "-x", normal: [-1, 0, 0], distance: 1 }, { id: "+y", normal: [0, 1, 0], distance: 1 }, { id: "-y", normal: [0, -1, 0], distance: 1 }, { id: "+z", normal: [0, 0, 1], distance: 1 }, { id: "-z", normal: [0, 0, -1], distance: 1 },
    ]);
    if (result.status !== "valid") throw new Error("Expected valid geometry");
    expect(result.geometry.faces.find((face) => face.planeId === "+x-tight")?.contributors.map((item) => item.formId)).toEqual(["tight", "tie"]);
});

it("generates cubic morphology from a developed {100} form", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const operations = resolvePointOperations({ registryId: "point-group:m-3m:standard" }, lattice.value);
    if (!operations.ok) throw new Error("Expected valid cubic symmetry");
    const result = generateCrystalGeometry({ lattice: lattice.value, operations: operations.value, forms: [{ id: "cube", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] });
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
        expect(result.geometry.faces).toHaveLength(6);
        expect(result.geometry.faces.every((face) => face.contributors[0]?.formId === "cube")).toBe(true);
    }
});

it("reports typed morphology input diagnostics", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const operations = resolvePointOperations({ identityOnly: true }, lattice.value);
    if (!operations.ok) throw new Error("Expected identity symmetry");
    const base = { lattice: lattice.value, operations: operations.value, forms: [{ id: "form", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 0 }] };
    expect(generateCrystalGeometry(base)).toMatchObject({ status: "invalid", diagnostics: [{ code: "core.geometry.no-active-forms" }] });
    expect(generateCrystalGeometry({ ...base, forms: [{ ...base.forms[0]!, development: -1 }] })).toMatchObject({ status: "invalid", diagnostics: [{ code: "core.input.invalid-development" }] });
    expect(generateCrystalGeometry({ ...base, morphologyScale: 0 })).toMatchObject({ status: "invalid", diagnostics: [{ code: "core.input.invalid-morphology-scale" }] });
});

it("scales valid morphology without changing topology", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const operations = resolvePointOperations({ registryId: "point-group:m-3m:standard" }, lattice.value);
    if (!operations.ok) throw new Error("Expected cubic symmetry");
    const input = { lattice: lattice.value, operations: operations.value, forms: [{ id: "cube", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 1 }] };
    const unit = generateCrystalGeometry(input);
    const scaled = generateCrystalGeometry({ ...input, morphologyScale: 5 });
    if (unit.status !== "valid" || scaled.status !== "valid") throw new Error("Expected valid geometry");
    expect(scaled.geometry.faces.map((face) => face.vertexIndices.length)).toEqual(unit.geometry.faces.map((face) => face.vertexIndices.length));
    expect(scaled.geometry.bounds.max).toEqual([5, 5, 5]);
});

it("produces deterministic geometry when forms are reordered", () => {
    const lattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    if (!lattice.ok) throw new Error("Expected valid cubic lattice");
    const operations = resolvePointOperations({ registryId: "point-group:m-3m:standard" }, lattice.value);
    if (!operations.ok) throw new Error("Expected cubic symmetry");
    const cube = { id: "cube", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 1 };
    const octahedron = { id: "octahedron", indices: { notation: "miller" as const, h: 1, k: 1, l: 1 }, development: 0.5 };
    const first = generateCrystalGeometry({ lattice: lattice.value, operations: operations.value, forms: [cube, octahedron] });
    const second = generateCrystalGeometry({ lattice: lattice.value, operations: operations.value, forms: [octahedron, cube] });
    expect(second).toEqual(first);
});
});

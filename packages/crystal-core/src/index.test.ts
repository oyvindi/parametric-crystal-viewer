import { describe, expect, it } from "vitest";

import { createLattice, transformMillerIndices, validateMillerIndices, validatePointOperations } from "./index.js";

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

it("rejects impossible and degenerate cells with a diagnostic", () => {
    const result = createLattice({ a: 1, b: 1, c: 1, alpha: 1, beta: 1, gamma: 179 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("core.input.invalid-unit-cell");
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
});

import assert from "node:assert/strict";
import test from "node:test";

import { createLattice, transformMillerIndices, validateMillerIndices } from "./index.js";

function assertMatrixClose(
    actual: readonly (readonly number[])[],
    expected: readonly (readonly number[])[],
    tolerance = 1e-12,
): void {
    for (let row = 0; row < expected.length; row += 1) {
        for (let column = 0; column < expected[row]!.length; column += 1) {
            assert.ok(Math.abs(actual[row]![column]! - expected[row]![column]!) <= tolerance);
        }
    }
}

test("crystal-core loads without browser globals", () => {
    assert.equal(typeof globalThis.window, "undefined");
    assert.equal(typeof globalThis.document, "undefined");
});

test("constructs the direct and reciprocal bases of a cubic cell", () => {
    const result = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assertMatrixClose(result.value.direct, [[4, 0, 0], [0, 4, 0], [0, 0, 4]]);
    assertMatrixClose(result.value.reciprocal, [[0.25, 0, 0], [0, 0.25, 0], [0, 0, 0.25]]);
    assert.equal(result.value.volume, 64);
});

test("rejects impossible and degenerate cells with a diagnostic", () => {
    const result = createLattice({ a: 1, b: 1, c: 1, alpha: 1, beta: 1, gamma: 179 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.diagnostics[0]?.code, "core.input.invalid-unit-cell");
});

test("reduces Miller indices without reversing their orientation", () => {
    const positive = validateMillerIndices({ notation: "miller", h: 2, k: 4, l: 6 });
    const negative = validateMillerIndices({ notation: "miller", h: -2, k: -4, l: -6 });
    assert.deepEqual(positive, { ok: true, value: { notation: "miller", h: 1, k: 2, l: 3 }, diagnostics: [] });
    assert.deepEqual(negative, { ok: true, value: { notation: "miller", h: -1, k: -2, l: -3 }, diagnostics: [] });
});

test("validates Miller–Bravais notation and its crystal-system constraint", () => {
    const valid = validateMillerIndices(
        { notation: "miller-bravais", h: 2, k: 2, i: -4, l: 6 },
        { crystalSystem: "hexagonal" },
    );
    assert.deepEqual(valid, {
        ok: true,
        value: { notation: "miller-bravais", h: 1, k: 1, i: -2, l: 3 },
        diagnostics: [],
    });
    const invalid = validateMillerIndices(
        { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 },
        { crystalSystem: "cubic" },
    );
    assert.equal(invalid.ok, false);
});

test("transforms Miller columns by inverse transpose", () => {
    const transformed = transformMillerIndices(
        { notation: "miller", h: 1, k: 0, l: 0 },
        [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    );
    assert.deepEqual(transformed, { ok: true, value: { notation: "miller", h: 0, k: 1, l: 0 }, diagnostics: [] });
});

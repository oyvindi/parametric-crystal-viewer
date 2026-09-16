import assert from "node:assert/strict";
import test from "node:test";

import { createLattice } from "./index.js";

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

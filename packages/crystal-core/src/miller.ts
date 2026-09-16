import type { Diagnostic, Result } from "./diagnostics.js";
import type { Mat3 } from "./lattice.js";

export type CrystalSystem =
    | "triclinic"
    | "monoclinic"
    | "orthorhombic"
    | "tetragonal"
    | "trigonal"
    | "hexagonal"
    | "cubic";

/** Miller indices in the declared fractional-coordinate basis. */
export type MillerIndices =
    | { readonly notation: "miller"; readonly h: number; readonly k: number; readonly l: number }
    | {
          readonly notation: "miller-bravais";
          readonly h: number;
          readonly k: number;
          readonly i: number;
          readonly l: number;
      };

export interface MillerValidationOptions {
    readonly crystalSystem?: CrystalSystem;
    readonly setting?: string;
}

function greatestCommonDivisor(left: number, right: number): number {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b !== 0) [a, b] = [b, a % b];
    return a;
}

function reduce(values: readonly number[]): readonly number[] {
    const divisor = values.reduce(greatestCommonDivisor, 0);
    return values.map((value) => value / divisor);
}

function invalid(path: string, message: string): Result<never> {
    const diagnostic: Diagnostic = {
        code: "core.input.invalid-miller-indices",
        severity: "error",
        message,
        path,
    };
    return { ok: false, diagnostics: [diagnostic] };
}

/**
 * Validates and reduces an index set. A common positive factor is removed but
 * its collective sign is retained, preserving opposite oriented planes.
 */
export function validateMillerIndices(
    indices: MillerIndices,
    options: MillerValidationOptions = {},
): Result<MillerIndices> {
    if (indices.notation !== "miller" && indices.notation !== "miller-bravais") return invalid("/notation", "Unknown index notation.");
    const values = indices.notation === "miller"
        ? [indices.h, indices.k, indices.l]
        : [indices.h, indices.k, indices.i, indices.l];

    const fieldNames = indices.notation === "miller" ? ["h", "k", "l"] : ["h", "k", "i", "l"];
    for (const [offset, value] of values.entries()) {
        if (!Number.isSafeInteger(value)) {
            return invalid(`/${fieldNames[offset] ?? offset}`, "Miller indices must be finite integers.");
        }
    }
    if (values.every((value) => value === 0)) {
        return invalid("/", "Miller indices must not all be zero.");
    }
    if (indices.notation === "miller-bravais") {
        if (options.setting?.startsWith("rhombohedral")) return invalid("/notation", "Miller–Bravais indices require hexagonal axes, not a rhombohedral primitive basis.");
        if (options.crystalSystem !== "hexagonal" && options.crystalSystem !== "trigonal") {
            return invalid("/notation", "Miller–Bravais indices require a trigonal or hexagonal crystal system.");
        }
        if (indices.i !== -(indices.h + indices.k)) {
            return invalid("/i", "Miller–Bravais i must equal -(h + k).");
        }
        const [h, k, i, l] = reduce(values);
        return { ok: true, value: { notation: "miller-bravais", h: h!, k: k!, i: i!, l: l! }, diagnostics: [] };
    }

    const [h, k, l] = reduce(values);
    return { ok: true, value: { notation: "miller", h: h!, k: k!, l: l! }, diagnostics: [] };
}

function determinant(matrix: Mat3): number {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function inverseTranspose(matrix: Mat3): Mat3 | undefined {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    const det = determinant(matrix);
    if (!Number.isFinite(det) || det === 0) return undefined;
    return [
        [(e * i - f * h) / det, (f * g - d * i) / det, (d * h - e * g) / det],
        [(c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det],
        [(b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det],
    ];
}

/** Transforms a three-index Miller column by the inverse transpose of W. */
export function transformMillerIndices(indices: MillerIndices, operation: Mat3): Result<MillerIndices> {
    if (indices.notation === "miller-bravais") {
        const threeIndex = millerBravaisToMiller(indices);
        const transformed = transformMillerIndices(threeIndex, operation);
        if (!transformed.ok || transformed.value.notation !== "miller") return transformed as Result<never>;
        return { ok: true, value: millerToMillerBravais(transformed.value), diagnostics: transformed.diagnostics };
    }
    const inverseTransposed = inverseTranspose(operation);
    if (!inverseTransposed) return invalid("/operation", "Point operation must be an invertible matrix.");
    const values = [indices.h, indices.k, indices.l] as const;
    const transformed = inverseTransposed.map((row) => row.reduce((sum, value, index) => sum + value * values[index]!, 0));
    if (!transformed.every(Number.isInteger)) {
        return invalid("/operation", "Point operation does not preserve integer Miller indices.");
    }
    return validateMillerIndices({ notation: "miller", h: transformed[0]!, k: transformed[1]!, l: transformed[2]! });
}

/**
 * Converts Miller-Bravais (h k i l) to three-index (h k l) by dropping the
 * redundant i index. Valid for hexagonal and trigonal settings where i = -(h+k).
 */
export function millerBravaisToMiller(indices: Extract<MillerIndices, { readonly notation: "miller-bravais" }>): Extract<MillerIndices, { readonly notation: "miller" }> {
    return { notation: "miller", h: indices.h, k: indices.k, l: indices.l };
}

/**
 * Converts three-index (h k l) to Miller-Bravais (h k i l) with i = -(h+k).
 * Valid for hexagonal and trigonal settings.
 */
export function millerToMillerBravais(indices: Extract<MillerIndices, { readonly notation: "miller" }>): Extract<MillerIndices, { readonly notation: "miller-bravais" }> {
    return { notation: "miller-bravais", h: indices.h, k: indices.k, i: -(indices.h + indices.k), l: indices.l };
}

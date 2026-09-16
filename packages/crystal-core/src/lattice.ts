import type { Diagnostic, Result } from "./diagnostics.js";

export type Vec3 = readonly [number, number, number];

/**
 * A row-major 3 × 3 matrix. Lattice vectors occupy the columns of `direct`.
 */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

export interface UnitCell {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly alpha: number;
    readonly beta: number;
    readonly gamma: number;
    readonly lengthUnit?: "angstrom" | "nanometre";
}

export interface Lattice {
    readonly direct: Mat3;
    readonly reciprocal: Mat3;
    readonly metric: Mat3;
    readonly volume: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const MINIMUM_RELATIVE_VOLUME = 1e-12;

function invalidCell(path: string, message: string): Result<never> {
    const diagnostic: Diagnostic = {
        code: "core.input.invalid-unit-cell",
        severity: "error",
        message,
        path,
    };
    return { ok: false, diagnostics: [diagnostic] };
}

function determinant(matrix: Mat3): number {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

function transpose(matrix: Mat3): Mat3 {
    return [
        [matrix[0][0], matrix[1][0], matrix[2][0]],
        [matrix[0][1], matrix[1][1], matrix[2][1]],
        [matrix[0][2], matrix[1][2], matrix[2][2]],
    ];
}

function inverse(matrix: Mat3): Mat3 | undefined {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    const det = determinant(matrix);
    if (!Number.isFinite(det) || det === 0) return undefined;

    return [
        [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
        [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
        [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
    ];
}

/** Constructs direct and reciprocal bases from a cell expressed in Å and degrees. */
export function createLattice(cell: UnitCell): Result<Lattice> {
    const lengthFactor = cell.lengthUnit === "nanometre" ? 10 : 1;
    if (cell.lengthUnit !== undefined && cell.lengthUnit !== "angstrom" && cell.lengthUnit !== "nanometre") return invalidCell("/lengthUnit", "Unsupported unit-cell length unit.");
    const normalized = { ...cell, a: cell.a * lengthFactor, b: cell.b * lengthFactor, c: cell.c * lengthFactor };
    cell = normalized;
    const lengths: ReadonlyArray<readonly [keyof UnitCell, number]> = [
        ["a", cell.a],
        ["b", cell.b],
        ["c", cell.c],
    ];
    const diagnostics: Diagnostic[] = [];
    for (const [name, value] of lengths) {
        if (!Number.isFinite(value) || value <= 0) {
            diagnostics.push(...invalidCell(`/${name}`, `${name} must be a finite positive length.`).diagnostics);
        }
    }

    const angles: ReadonlyArray<readonly [keyof UnitCell, number]> = [
        ["alpha", cell.alpha],
        ["beta", cell.beta],
        ["gamma", cell.gamma],
    ];
    for (const [name, value] of angles) {
        if (!Number.isFinite(value) || value <= 0 || value >= 180) {
            diagnostics.push(...invalidCell(`/${name}`, `${name} must be a finite angle between 0 and 180 degrees.`).diagnostics);
        }
    }

    if (diagnostics.length) return { ok: false, diagnostics };
    const alpha = cell.alpha * DEGREES_TO_RADIANS;
    const beta = cell.beta * DEGREES_TO_RADIANS;
    const gamma = cell.gamma * DEGREES_TO_RADIANS;
    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);
    const sinGamma = Math.sin(gamma);

    const cX = cell.c * cosBeta;
    const cY = (cell.c * (cosAlpha - cosBeta * cosGamma)) / sinGamma;
    const cZSquared = cell.c * cell.c - cX * cX - cY * cY;
    const scaleSquared = Math.max(cell.a * cell.a, cell.b * cell.b, cell.c * cell.c);
    if (!Number.isFinite(cZSquared) || cZSquared <= scaleSquared * MINIMUM_RELATIVE_VOLUME ** 2) {
        return invalidCell("/", "Unit-cell angles produce a degenerate or impossible cell.");
    }
    const cZ = Math.sqrt(cZSquared);
    const direct: Mat3 = [
        [cell.a, cell.b * cosGamma, cX],
        [0, cell.b * sinGamma, cY],
        [0, 0, cZ],
    ];
    const volume = determinant(direct);
    const reciprocal = inverse(transpose(direct));
    if (!reciprocal || !reciprocal.flat().every(Number.isFinite) || !Number.isFinite(volume) || volume <= Math.max(cell.a, cell.b, cell.c) ** 3 * MINIMUM_RELATIVE_VOLUME) {
        return invalidCell("/", "Unit-cell basis cannot be inverted reliably.");
    }

    const metric: Mat3 = [
        [cell.a ** 2, cell.a * cell.b * cosGamma, cell.a * cell.c * cosBeta],
        [cell.a * cell.b * cosGamma, cell.b ** 2, cell.b * cell.c * cosAlpha],
        [cell.a * cell.c * cosBeta, cell.b * cell.c * cosAlpha, cell.c ** 2],
    ];
    if (!metric.flat().every(Number.isFinite)) return invalidCell("/", "Unit-cell metric exceeds the numerical range.");
    return { ok: true, value: { direct, reciprocal, metric, volume }, diagnostics: [] };
}

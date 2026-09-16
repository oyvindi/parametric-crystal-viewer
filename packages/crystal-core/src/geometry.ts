import type { Diagnostic } from "./diagnostics.js";
import type { Vec3 } from "./lattice.js";

export interface HalfSpace {
    readonly id: string;
    readonly normal: Vec3;
    readonly distance: number;
}

export interface CrystalGeometry {
    readonly vertices: Float64Array;
    readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}

export type GeometryResult =
    | { readonly status: "valid"; readonly geometry: CrystalGeometry; readonly diagnostics: readonly Diagnostic[] }
    | { readonly status: "invalid"; readonly diagnostics: readonly Diagnostic[] };

const EPSILON = 1e-9;

function dot(left: Vec3, right: Vec3): number {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ];
}

function intersection(a: HalfSpace, b: HalfSpace, c: HalfSpace): Vec3 | undefined {
    const bCrossC = cross(b.normal, c.normal);
    const cCrossA = cross(c.normal, a.normal);
    const aCrossB = cross(a.normal, b.normal);
    const determinant = dot(a.normal, bCrossC);
    if (Math.abs(determinant) <= EPSILON) return undefined;
    return [
        (a.distance * bCrossC[0] + b.distance * cCrossA[0] + c.distance * aCrossB[0]) / determinant,
        (a.distance * bCrossC[1] + b.distance * cCrossA[1] + c.distance * aCrossB[1]) / determinant,
        (a.distance * bCrossC[2] + b.distance * cCrossA[2] + c.distance * aCrossB[2]) / determinant,
    ];
}

function invalid(code: string, message: string): GeometryResult {
    return { status: "invalid", diagnostics: [{ code, severity: "error", message }] };
}

/** Intersects planes of the form `normal · point <= distance` without seed bounds. */
export function intersectHalfSpaces(halfSpaces: readonly HalfSpace[]): GeometryResult {
    if (halfSpaces.length === 0) return invalid("core.geometry.no-active-forms", "No active half-space constraints were supplied.");
    if (halfSpaces.some((plane) => !Number.isFinite(plane.distance) || plane.normal.some((value) => !Number.isFinite(value)))) {
        return invalid("core.input.invalid-half-space", "Half-space normals and distances must be finite.");
    }
    const vertices: Vec3[] = [];
    for (let first = 0; first < halfSpaces.length - 2; first += 1) for (let second = first + 1; second < halfSpaces.length - 1; second += 1) for (let third = second + 1; third < halfSpaces.length; third += 1) {
        const point = intersection(halfSpaces[first]!, halfSpaces[second]!, halfSpaces[third]!);
        if (!point || !point.every(Number.isFinite)) continue;
        if (halfSpaces.every((plane) => dot(plane.normal, point) <= plane.distance + EPSILON)
            && !vertices.some((vertex) => Math.hypot(vertex[0] - point[0], vertex[1] - point[1], vertex[2] - point[2]) <= EPSILON)) vertices.push(point);
    }
    if (vertices.length < 4) return invalid("core.geometry.unbounded", "Half-space constraints do not enclose a usable three-dimensional volume.");
    const min: Vec3 = [Math.min(...vertices.map((v) => v[0])), Math.min(...vertices.map((v) => v[1])), Math.min(...vertices.map((v) => v[2]))];
    const max: Vec3 = [Math.max(...vertices.map((v) => v[0])), Math.max(...vertices.map((v) => v[1])), Math.max(...vertices.map((v) => v[2]))];
    return { status: "valid", geometry: { vertices: new Float64Array(vertices.flat()), bounds: { min, max } }, diagnostics: [] };
}

import type { Diagnostic } from "./diagnostics.js";
import type { Vec3 } from "./lattice.js";

export interface HalfSpace {
    readonly id: string;
    readonly normal: Vec3;
    readonly distance: number;
    readonly contributors?: readonly FaceContributor[];
}

export interface FaceContributor { readonly formId: string; readonly operationIds: readonly string[]; }

export interface CrystalGeometry {
    readonly vertices: Float64Array;
    readonly faces: readonly CrystalFace[];
    readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}

export interface CrystalFace {
    readonly vertexIndices: readonly number[];
    readonly normal: Vec3;
    readonly planeId: string;
    readonly contributors: readonly FaceContributor[];
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

function normalize(vector: Vec3): Vec3 | undefined {
    const length = Math.hypot(...vector);
    return length > EPSILON && Number.isFinite(length) ? [vector[0] / length, vector[1] / length, vector[2] / length] : undefined;
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
    if (halfSpaces.some((plane) => !Number.isFinite(plane.distance) || !normalize(plane.normal))) {
        return invalid("core.input.invalid-half-space", "Half-space normals and distances must be finite.");
    }
    const constraints: HalfSpace[] = [];
    for (const plane of halfSpaces) {
        const magnitude = Math.hypot(...plane.normal);
        const normalized: HalfSpace = { ...plane, normal: [plane.normal[0] / magnitude, plane.normal[1] / magnitude, plane.normal[2] / magnitude], distance: plane.distance / magnitude };
        const existing = constraints.find((candidate) => Math.abs(dot(candidate.normal, normalized.normal) - 1) <= EPSILON);
        if (!existing) { constraints.push(normalized); continue; }
        if (normalized.distance < existing.distance - EPSILON) constraints[constraints.indexOf(existing)] = normalized;
        else if (Math.abs(normalized.distance - existing.distance) <= EPSILON) constraints[constraints.indexOf(existing)] = { ...existing, contributors: [...(existing.contributors ?? []), ...(normalized.contributors ?? [])] };
    }
    const vertices: Vec3[] = [];
    for (let first = 0; first < constraints.length - 2; first += 1) for (let second = first + 1; second < constraints.length - 1; second += 1) for (let third = second + 1; third < constraints.length; third += 1) {
        const point = intersection(constraints[first]!, constraints[second]!, constraints[third]!);
        if (!point || !point.every(Number.isFinite)) continue;
        if (constraints.every((plane) => dot(plane.normal, point) <= plane.distance + EPSILON)
            && !vertices.some((vertex) => Math.hypot(vertex[0] - point[0], vertex[1] - point[1], vertex[2] - point[2]) <= EPSILON)) vertices.push(point);
    }
    if (vertices.length < 4) return invalid("core.geometry.unbounded", "Half-space constraints do not enclose a usable three-dimensional volume.");
    vertices.sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
    const faces: CrystalFace[] = [];
    for (const plane of constraints) {
        const normal = normalize(plane.normal)!;
        const boundary = vertices.map((vertex, index) => ({ vertex, index }))
            .filter(({ vertex }) => Math.abs(dot(plane.normal, vertex) - plane.distance) <= EPSILON);
        if (boundary.length < 3) continue;
        const reference: Vec3 = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const u = normalize(cross(reference, normal))!;
        const v = cross(normal, u);
        const center: Vec3 = boundary.reduce<Vec3>((sum, item) => [sum[0] + item.vertex[0] / boundary.length, sum[1] + item.vertex[1] / boundary.length, sum[2] + item.vertex[2] / boundary.length], [0, 0, 0]);
        boundary.sort((left, right) => Math.atan2(dot(v, [left.vertex[0] - center[0], left.vertex[1] - center[1], left.vertex[2] - center[2]]), dot(u, [left.vertex[0] - center[0], left.vertex[1] - center[1], left.vertex[2] - center[2]])) - Math.atan2(dot(v, [right.vertex[0] - center[0], right.vertex[1] - center[1], right.vertex[2] - center[2]]), dot(u, [right.vertex[0] - center[0], right.vertex[1] - center[1], right.vertex[2] - center[2]])));
        faces.push({ vertexIndices: boundary.map((item) => item.index), normal, planeId: plane.id, contributors: plane.contributors ?? [] });
    }
    const min: Vec3 = [Math.min(...vertices.map((v) => v[0])), Math.min(...vertices.map((v) => v[1])), Math.min(...vertices.map((v) => v[2]))];
    const max: Vec3 = [Math.max(...vertices.map((v) => v[0])), Math.max(...vertices.map((v) => v[1])), Math.max(...vertices.map((v) => v[2]))];
    if ((max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]) <= EPSILON) return invalid("core.geometry.degenerate", "Half-space intersection has no usable three-dimensional volume.");
    return { status: "valid", geometry: { vertices: new Float64Array(vertices.flat()), faces, bounds: { min, max } }, diagnostics: [] };
}

import type { Diagnostic } from "./diagnostics.js";
import type { MillerIndices } from "./miller.js";
import { TOLERANCES as T, relativeTolerance } from "./tolerances.js";
import type { Vec3 } from "./lattice.js";

export interface HalfSpace {
    readonly id: string;
    readonly normal: Vec3;
    readonly distance: number;
    readonly contributors?: readonly FaceContributor[];
}

export interface FaceContributor { readonly formId: string; readonly indices?: MillerIndices; readonly operationIds: readonly string[]; }

export interface CrystalGeometry {
    readonly vertices: Float64Array;
    readonly faces: readonly CrystalFace[];
    readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}

export interface CrystalFace {
    readonly vertexIndices: readonly number[];
    readonly normal: Vec3;
    readonly planeId: string;
    readonly symmetryGroup?: string;
    readonly contributors: readonly FaceContributor[];
}

export type GeometryResult =
    | { readonly status: "valid"; readonly geometry: CrystalGeometry; readonly diagnostics: readonly Diagnostic[] }
    | { readonly status: "invalid"; readonly diagnostics: readonly Diagnostic[] };

const EPSILON = T.matrix;

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

/** Tests extreme rays of the recession cone, including rank-deficient normal sets. */
function recession(constraints: readonly HalfSpace[]): "bounded" | "unbounded" | "uncertain" {
    const axes: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const candidates: Vec3[] = [...axes];
    for (let i = 0; i < constraints.length; i++) {
        const n = constraints[i]!.normal;
        candidates.push(n, ...axes.map((axis) => cross(n, axis)));
        for (let j = i + 1; j < constraints.length; j++) candidates.push(cross(n, constraints[j]!.normal));
    }
    let uncertain = false;
    for (const candidate of candidates) {
        const ray = normalize(candidate);
        if (!ray) continue;
        for (const sign of [-1, 1]) {
            const maximum = Math.max(...constraints.map((p) => sign * dot(p.normal, ray)));
            if (maximum <= 16 * Number.EPSILON) return "unbounded";
            if (maximum <= T.matrix) uncertain = true;
        }
    }
    return uncertain ? "uncertain" : "bounded";
}

function contributors(planes: readonly HalfSpace[]): readonly FaceContributor[] {
    const groups = new Map<string, FaceContributor>();
    for (const plane of planes) for (const item of plane.contributors ?? []) {
        const previous = groups.get(item.formId);
        groups.set(item.formId, { ...item, operationIds: [...new Set([...(previous?.operationIds ?? []), ...item.operationIds])].sort() });
    }
    return [...groups.values()].sort((a, b) => a.formId.localeCompare(b.formId));
}

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Removes vertices lying between their neighbours on a straight polygon edge. */
export function removeCollinearVertices(boundary: readonly number[], vertices: readonly Vec3[]): number[] {
    const result = [...boundary];
    let changed = true;
    while (changed && result.length >= 3) {
        changed = false;
        for (let i = 0; i < result.length; i++) {
            const a = vertices[result[(i + result.length - 1) % result.length]!]!;
            const b = vertices[result[i]!]!;
            const c = vertices[result[(i + 1) % result.length]!]!;
            const ab = subtract(b, a), bc = subtract(c, b);
            if (dot(ab, bc) >= 0 && Math.hypot(...cross(ab, bc)) <= T.collinear * Math.hypot(...ab) * Math.hypot(...bc)) {
                result.splice(i, 1); changed = true; break;
            }
        }
    }
    return result;
}

/** Intersects non-negative-support planes `normal · point <= distance`, without seed bounds. */
export function intersectHalfSpaces(halfSpaces: readonly HalfSpace[]): GeometryResult {
    if (halfSpaces.length === 0) return invalid("core.geometry.no-active-forms", "No active half-space constraints were supplied.");
    const diagnostics: Diagnostic[] = [];
    const normalized: HalfSpace[] = [];
    const ids = new Set<string>();
    for (const [index, plane] of halfSpaces.entries()) {
        const magnitude = Math.hypot(...plane.normal);
        if (!plane.id || ids.has(plane.id) || !Number.isFinite(plane.distance) || plane.distance < 0 || !Number.isFinite(magnitude) || magnitude === 0 || !Number.isFinite(plane.distance / magnitude)) {
            diagnostics.push({ code: "core.input.invalid-half-space", severity: "error", path: `/${index}`, message: "Half-spaces require unique IDs, finite non-zero normals and finite non-negative normalized distances." });
        } else normalized.push({ ...plane, normal: plane.normal.map((x) => x / magnitude) as unknown as Vec3, distance: plane.distance / magnitude });
        ids.add(plane.id);
    }
    if (diagnostics.length) return { status: "invalid", diagnostics };
    // Sorting by support first makes each group's representative the true minimum,
    // avoiding non-transitive tolerance chains and input-order-dependent ties.
    normalized.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    const groups: HalfSpace[][] = [];
    for (const plane of normalized) {
        const group = groups.find(([first]) => Math.hypot(...subtract(first!.normal, plane.normal)) <= T.normal);
        if (group) group.push(plane); else groups.push([plane]);
    }
    const constraints = groups.map((group): HalfSpace => {
        const first = group[0]!;
        const tied = group.filter((p) => Math.abs(p.distance - first.distance) <= relativeTolerance(T.plane, first.distance));
        return { ...first, contributors: contributors(tied) };
    }).sort((a, b) => a.id.localeCompare(b.id));
    const boundedness = recession(constraints);
    if (boundedness === "unbounded") return invalid("core.geometry.unbounded", "Active normals admit a non-zero recession direction.");
    if (boundedness === "uncertain") return invalid("core.geometry.numerical-failure", "Normal configuration is too close to an unbounded intersection to resolve reliably.");
    const vertices: Vec3[] = [];
    let arithmeticFailure = false;
    for (let first = 0; first < constraints.length - 2; first++) for (let second = first + 1; second < constraints.length - 1; second++) for (let third = second + 1; third < constraints.length; third++) {
        const point = intersection(constraints[first]!, constraints[second]!, constraints[third]!);
        if (!point) continue;
        if (!point.every(Number.isFinite)) { arithmeticFailure = true; continue; }
        if (constraints.every((plane) => dot(plane.normal, point) <= plane.distance + relativeTolerance(T.plane, plane.distance, ...point))
            && !vertices.some((vertex) => Math.hypot(...subtract(vertex, point)) <= relativeTolerance(T.vertex, ...vertex, ...point))) vertices.push(point);
    }
    if (arithmeticFailure) return invalid("core.geometry.numerical-failure", "Triple-plane arithmetic exceeded the finite numerical range.");
    if (vertices.length < 4) return invalid(constraints.some((p) => p.distance === 0) ? "core.geometry.degenerate" : "core.geometry.numerical-failure", "Bounded intersection could not resolve four distinct vertices.");
    vertices.sort((left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]);
    const faces: CrystalFace[] = [];
    for (const plane of constraints) {
        const normal = plane.normal;
        const boundary = vertices.map((vertex, index) => ({ vertex, index }))
            .filter(({ vertex }) => Math.abs(dot(normal, vertex) - plane.distance) <= relativeTolerance(T.plane, plane.distance, ...vertex));
        if (boundary.length < 3) continue;
        const reference: Vec3 = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const u = normalize(cross(reference, normal))!;
        const v = cross(normal, u);
        const center: Vec3 = boundary.reduce<Vec3>((sum, item) => [sum[0] + item.vertex[0] / boundary.length, sum[1] + item.vertex[1] / boundary.length, sum[2] + item.vertex[2] / boundary.length], [0, 0, 0]);
        boundary.sort((a, b) => Math.atan2(dot(v, subtract(a.vertex, center)), dot(u, subtract(a.vertex, center))) - Math.atan2(dot(v, subtract(b.vertex, center)), dot(u, subtract(b.vertex, center))));
        const loop = removeCollinearVertices(boundary.map((item) => item.index), vertices);
        if (loop.length < 3) continue;
        const start = loop.indexOf(Math.min(...loop));
        faces.push({ vertexIndices: [...loop.slice(start), ...loop.slice(0, start)], normal, planeId: plane.id, contributors: plane.contributors ?? [] });
    }
    const min: Vec3 = [Math.min(...vertices.map((v) => v[0])), Math.min(...vertices.map((v) => v[1])), Math.min(...vertices.map((v) => v[2]))];
    const max: Vec3 = [Math.max(...vertices.map((v) => v[0])), Math.max(...vertices.map((v) => v[1])), Math.max(...vertices.map((v) => v[2]))];
    const extent = Math.max(...subtract(max, min));
    let volume = 0;
    const edges = new Map<string, { count: number; balance: number }>();
    const used = new Set<number>();
    for (const face of faces) {
        const loop = face.vertexIndices;
        for (let i = 0; i < loop.length; i++) {
            const a = loop[i]!, b = loop[(i + 1) % loop.length]!;
            used.add(a);
            const key = `${Math.min(a, b)},${Math.max(a, b)}`;
            const edge = edges.get(key) ?? { count: 0, balance: 0 };
            edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
        }
        for (let i = 1; i < loop.length - 1; i++) {
            const a = vertices[loop[0]!]!, b = vertices[loop[i]!]!, c = vertices[loop[i + 1]!]!;
            if (dot(cross(subtract(b, a), subtract(c, a)), face.normal) <= 0) return invalid("core.geometry.numerical-failure", "Polygon winding could not be resolved reliably.");
            volume += dot(a, cross(b, c)) / 6;
        }
    }
    if (!Number.isFinite(volume) || !Number.isFinite(extent ** 3)) return invalid("core.geometry.numerical-failure", "Volume arithmetic exceeded the numerical range.");
    if (volume <= T.volume * Math.max(1, extent ** 3)) return invalid("core.geometry.degenerate", "Intersection lacks usable volume relative to its extent.");
    if (faces.length < 4 || used.size - edges.size + faces.length !== 2 || [...edges.values()].some((e) => e.count !== 2 || e.balance !== 0)) return invalid("core.geometry.numerical-failure", "Intersection failed closed-manifold topology validation.");
    // Remove unused vertices (for example, a redundant collinear intersection).
    const retained = [...used].sort((a, b) => a - b);
    const remap = new Map(retained.map((old, index) => [old, index]));
    return { status: "valid", geometry: { vertices: new Float64Array(retained.flatMap((i) => [...vertices[i]!])), faces: faces.map((f) => ({ ...f, vertexIndices: f.vertexIndices.map((i) => remap.get(i)!) })), bounds: { min, max } }, diagnostics: [] };
}

/** SR10 design spike only. Deliberately absent from the package entry point. */
import type { CrystalGeometry, Diagnostic } from "@crystal/core";
import type { DisplayGrowthComponent, DisplayGrowthGeometry } from "../display-growth.js";

type Point = [number, number, number];
type Box = { min: Point; max: Point; faces: number[] };
type Rect = { axis: number; sign: number; plane: number; u: number; v: number; lo: [number, number]; hi: [number, number]; face: number };
export type UnionResult = { status: "valid"; geometry: DisplayGrowthGeometry; rectangles: number } | { status: "rejected"; diagnostic: Diagnostic };
const ROUND = 2e-12;
const SEPARATION = 1e-9;
const AREA = 1e-20;
const VOLUME = 1e-12;
const MAX_BOXES = 512;
const MAX_RECTS = 100_000;
const MAX_TRIANGLES = 250_000;
class Rejection extends Error {
    constructor(readonly code: string, message: string) { super(message); }
}
function requireThat(condition: unknown, code: string, message: string): asserts condition {
    if (!condition) throw new Rejection(code, message);
}
const key = (p: readonly number[]): string => p.join(",");
const cross = (a: Point, b: Point): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point, b: Point): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const point = (a: Float64Array, i: number): Point => [a[i]!, a[i + 1]!, a[i + 2]!];

/** Exact-coordinate topology check; call in normalized units, including for GPU checks. */
export function inspectUnionTopology(component: DisplayGrowthComponent, faceCount: number): { vertices: number; edges: number; triangles: number; volume: number } {
    const { positions, triangleFaces } = component;
    requireThat(positions.length > 0 && positions.length % 9 === 0 && triangleFaces.length === positions.length / 9, "topology", "Malformed triangle buffers.");
    const vertices = new Map<string, number>();
    const edges = new Map<string, { a: number; b: number; triangles: number[] }>();
    const links: Map<number, Set<number>>[] = [];
    const adjacency: number[][] = Array.from({ length: triangleFaces.length }, () => []);
    let volume = 0;
    for (let i = 0; i < positions.length; i += 9) {
        requireThat(triangleFaces[i / 9]! < faceCount, "provenance", "Triangle has no originating core face.");
        const p = [point(positions, i), point(positions, i + 3), point(positions, i + 6)] as const;
        requireThat(p.flat().every(Number.isFinite), "numerical", "Non-finite triangle.");
        requireThat(Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) > AREA, "topology", "Degenerate triangle.");
        volume += dot(p[0], cross(p[1], p[2])) / 6;
        const ids = p.map(value => {
            const k = key(value); let id = vertices.get(k);
            if (id === undefined) { id = vertices.size; vertices.set(k, id); links.push(new Map()); }
            return id;
        });
        for (let j = 0; j < 3; j++) {
            const a = ids[j]!; const b = ids[(j + 1) % 3]!; const c = ids[(j + 2) % 3]!;
            const k = a < b ? `${a},${b}` : `${b},${a}`;
            const edge = edges.get(k);
            if (!edge) edges.set(k, { a, b, triangles: [i / 9] });
            else {
                requireThat(edge.triangles.length === 1 && edge.a === b && edge.b === a, "topology", "Open, duplicate, or inconsistently wound edge.");
                const other = edge.triangles[0]!;
                adjacency[other]!.push(i / 9); adjacency[i / 9]!.push(other); edge.triangles.push(i / 9);
            }
            const link = links[a]!;
            for (const [x, y] of [[b, c], [c, b]]) {
                if (!link.has(x!)) link.set(x!, new Set());
                link.get(x!)!.add(y!);
            }
        }
    }
    requireThat([...edges.values()].every(edge => edge.triangles.length === 2), "topology", "Open edge.");
    const connected = (start: number, neighbors: (id: number) => Iterable<number>): Set<number> => {
        const seen = new Set<number>([start]); const pending = [start];
        while (pending.length) for (const next of neighbors(pending.pop()!)) if (!seen.has(next)) { seen.add(next); pending.push(next); }
        return seen;
    };
    requireThat(connected(0, id => adjacency[id]!).size === triangleFaces.length, "topology", "Disconnected boundary.");
    for (const link of links) {
        requireThat([...link.values()].every(neighbors => neighbors.size === 2) && connected(link.keys().next().value!, id => link.get(id)!).size === link.size, "topology", "Non-manifold vertex link.");
    }
    requireThat(vertices.size - edges.size + triangleFaces.length === 2, "topology", "Unexpected cavity or handle.");
    requireThat(Number.isFinite(volume) && volume > VOLUME, "topology", "Non-positive solid volume.");
    return { vertices: vertices.size, edges: edges.size, triangles: triangleFaces.length, volume };
}

function readBox(component: DisplayGrowthComponent): Box {
    requireThat(component.positions.length === 108 && component.triangleFaces.length === 12, "unsupported-input", "Expected a twelve-triangle box operand.");
    const min: Point = [Infinity, Infinity, Infinity]; const max: Point = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < component.positions.length; i++) { const a = i % 3; min[a] = Math.min(min[a]!, component.positions[i]!); max[a] = Math.max(max[a]!, component.positions[i]!); }
    requireThat(min.every((v, a) => max[a]! - v >= SEPARATION), "numerical", "Collapsed box extent.");
    const faces: number[] = Array(6).fill(-1); const areas: number[] = Array(6).fill(0);
    for (let i = 0; i < 108; i += 9) {
        const p = [point(component.positions, i), point(component.positions, i + 3), point(component.positions, i + 6)] as const;
        requireThat(p.every(value => value.every((x, a) => x === min[a] || x === max[a])), "unsupported-input", "Operand is not an axis-aligned box.");
        const normal = cross(sub(p[1], p[0]), sub(p[2], p[0]));
        const axis = normal.findIndex(x => x !== 0);
        requireThat(axis >= 0 && normal.every((x, a) => a === axis || x === 0), "unsupported-input", "Operand has a non-box face.");
        const sign = normal[axis]! > 0 ? 1 : -1; const side = axis * 2 + (sign > 0 ? 1 : 0);
        requireThat(p.every(value => value[axis] === (sign > 0 ? max[axis] : min[axis])), "unsupported-input", "Operand winding is not outward.");
        const face = component.triangleFaces[i / 9]!;
        requireThat(faces[side] === -1 || faces[side] === face, "provenance", "Ambiguous operand face attribution.");
        faces[side] = face; areas[side] = areas[side]! + Math.abs(normal[axis]!) / 2;
    }
    for (let a = 0; a < 3; a++) {
        const expected = (max[(a + 1) % 3]! - min[(a + 1) % 3]!) * (max[(a + 2) % 3]! - min[(a + 2) % 3]!);
        requireThat([0, 1].every(s => Math.abs(areas[a * 2 + s]! - expected) <= ROUND * expected), "unsupported-input", "Incomplete box surface.");
    }
    inspectUnionTopology(component, 6);
    return { min, max, faces };
}

function subtract(rect: Rect, box: Box): Rect[] {
    const lo: [number, number] = [Math.max(rect.lo[0], box.min[rect.u]!), Math.max(rect.lo[1], box.min[rect.v]!)];
    const hi: [number, number] = [Math.min(rect.hi[0], box.max[rect.u]!), Math.min(rect.hi[1], box.max[rect.v]!)];
    if (lo[0] >= hi[0] || lo[1] >= hi[1]) return [rect];
    const result: Rect[] = [];
    const add = (u0: number, v0: number, u1: number, v1: number): void => { if (u0 < u1 && v0 < v1) result.push({ ...rect, lo: [u0, v0], hi: [u1, v1] }); };
    add(rect.lo[0], rect.lo[1], lo[0], rect.hi[1]);
    add(hi[0], rect.lo[1], rect.hi[0], rect.hi[1]);
    add(lo[0], rect.lo[1], hi[0], lo[1]);
    add(lo[0], hi[1], hi[0], rect.hi[1]);
    return result;
}

/** Isolated union; optional edge operands use the separately reviewed experimental envelope. */
export function unionTerracedCube(core: CrystalGeometry, display: DisplayGrowthGeometry, edgeOperands: readonly DisplayGrowthComponent[] = []): UnionResult {
    try {
        requireThat(display.components.length > 0 && display.components.length <= MAX_BOXES, "budget", "Expected 1–512 box operands.");
        requireThat(edgeOperands.length <= 128, "budget", "At most 128 experimental edge/corner operands are supported.");
        const components = [...display.components, ...edgeOperands];
        requireThat(core.faces.length === 6 && core.vertices.length === 24, "unsupported-input", "Only a six-face cube core is supported.");
        const origin = core.bounds.min;
        const side = core.bounds.max[0] - origin[0];
        requireThat(Number.isFinite(side) && side > 0 && origin.every(Number.isFinite) && core.bounds.max.every((v, a) => Number.isFinite(v) && Math.abs((v - origin[a]!) / side - 1) <= ROUND), "unsupported-input", "Core bounds must be cubic.");
        requireThat(components.every(component => component.positions.length === 108 && component.triangleFaces.length === 12), "unsupported-input", "Expected twelve-triangle box operands.");
        const normalized = components.map(component => ({ positions: Float64Array.from(component.positions, (v, i) => (v - origin[i % 3]!) / side), triangleFaces: component.triangleFaces }));
        // Canonical representatives depend only on the sorted coordinates, never input order.
        for (let a = 0; a < 3; a++) {
            const values = new Set<number>([0, 1]);
            for (const component of normalized) for (let i = a; i < component.positions.length; i += 3) values.add(component.positions[i]!);
            requireThat([...values].every(Number.isFinite), "numerical", "Non-finite operand coordinate.");
            const mapping = new Map<number, number>(); let anchor = -Infinity;
            for (const value of [...values].sort((x, y) => x - y)) {
                if (value - anchor > ROUND) { requireThat(value - anchor >= SEPARATION, "numerical", "Unresolved near-coincident planes."); anchor = value; }
                mapping.set(value, anchor);
            }
            for (const component of normalized) for (let i = a; i < component.positions.length; i += 3) component.positions[i] = mapping.get(component.positions[i]!)!;
        }
        const boxes = normalized.map(readBox); const base = boxes[0]!;
        requireThat(base.min.every(x => Math.abs(x) <= ROUND) && base.max.every(x => Math.abs(x - 1) <= ROUND), "unsupported-input", "First operand must match the scientific core.");
        requireThat(new Set(base.faces).size === 6, "provenance", "Core faces must have unique attribution.");
        for (let a = 0; a < 3; a++) for (const s of [0, 1]) {
            const face = core.faces[base.faces[a * 2 + s]!]!;
            requireThat(face && face.vertexIndices.length === 4 && face.contributors.some(c => c.formId === "a" && c.indices?.notation === "miller" && Math.abs(c.indices.h) + Math.abs(c.indices.k) + Math.abs(c.indices.l) === 1), "unsupported-input", "Core requires cube-form a / {100} faces.");
            requireThat(face.normal.every((x, axis) => Math.abs(x - (axis === a ? s * 2 - 1 : 0)) <= ROUND), "unsupported-input", "Core normal is not axis aligned.");
            const corners = new Set<string>();
            for (const index of face.vertexIndices) {
                const p = [0, 1, 2].map(axis => (core.vertices[index * 3 + axis]! - origin[axis]!) / side);
                requireThat(p.every((x, axis) => Number.isFinite(x) && (axis === a ? Math.abs(x - s) <= ROUND : Math.min(Math.abs(x), Math.abs(x - 1)) <= ROUND)), "unsupported-input", "Core polygon is not a cube face.");
                corners.add(key(p.map(Math.round)));
            }
            requireThat(corners.size === 4, "unsupported-input", "Core face lacks four corners.");
        }
        for (const box of boxes.slice(1, display.components.length)) {
            const face = box.faces[0]!;
            requireThat(box.faces.every(value => value === face), "provenance", "Child must originate on exactly one core face.");
            const sideIndex = base.faces.indexOf(face); const a = Math.floor(sideIndex / 2); const positive = sideIndex % 2 === 1;
            requireThat(sideIndex >= 0, "provenance", "Unknown originating face.");
            requireThat(box.min.every((x, axis) => axis === a || x >= base.min[axis]!) && box.max.every((x, axis) => axis === a || x <= base.max[axis]!), "footprint", "Child footprint crosses its source face.");
            const plane = positive ? base.max[a]! : base.min[a]!;
            requireThat(box.min[a]! < plane && box.max[a]! > plane && (positive ? box.min[a]! > base.min[a]! : box.max[a]! < base.max[a]!), "unsupported-input", "Child must overlap through only its source face with positive volume.");
        }
        for (const box of boxes.slice(display.components.length)) {
            requireThat(box.min.every((x, a) => Math.max(x, base.min[a]!) < Math.min(box.max[a]!, base.max[a]!)), "unsupported-input", "Edge growth must overlap the core with positive volume.");
            requireThat(box.min.every((x, a) => box.max[a]! - x <= 0.22 + ROUND && x >= base.min[a]! - 0.06 - ROUND && box.max[a]! <= base.max[a]! + 0.06 + ROUND), "footprint", "Edge growth exceeds the shallow local operand envelope.");
            const incident: number[] = [];
            for (let a = 0; a < 3; a++) {
                if (box.min[a]! < base.min[a]!) incident.push(a * 2);
                if (box.max[a]! > base.max[a]!) incident.push(a * 2 + 1);
            }
            requireThat(incident.length >= 2 && incident.length <= 3 && new Set(incident.map(side => Math.floor(side / 2))).size === incident.length, "footprint", "Edge growth must cross two or three incident core faces.");
            const fallback = Math.min(...incident.map(side => base.faces[side]!));
            requireThat(box.faces.every((face, side) => face === (incident.includes(side) ? base.faces[side] : fallback)), "provenance", "Edge/corner surface attribution does not match its incident core faces.");
        }
        const compare = (a: Box, b: Box): number => {
            const left = [a.faces[0]!, ...a.min, ...a.max]; const right = [b.faces[0]!, ...b.min, ...b.max];
            for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
            return 0;
        };
        const ordered = [base, ...boxes.slice(1).sort(compare)];
        const rectangles: Rect[] = [];
        ordered.forEach((box, boxIndex) => {
            for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
                const u = (axis + 1) % 3; const v = (axis + 2) % 3;
                const plane = sign > 0 ? box.max[axis]! : box.min[axis]!;
                let fragments: Rect[] = [{ axis, sign, plane, u, v, lo: [box.min[u]!, box.min[v]!], hi: [box.max[u]!, box.max[v]!], face: box.faces[axis * 2 + (sign > 0 ? 1 : 0)]! }];
                ordered.forEach((other, index) => {
                    if (index === boxIndex || !fragments.length) return;
                    const outsideCovered = sign > 0 ? other.min[axis]! <= plane && other.max[axis]! > plane : other.max[axis]! >= plane && other.min[axis]! < plane;
                    const duplicate = index < boxIndex && (sign > 0 ? other.max[axis] === plane : other.min[axis] === plane);
                    if (outsideCovered || duplicate) fragments = fragments.flatMap(rect => subtract(rect, other));
                    requireThat(rectangles.length + fragments.length <= MAX_RECTS, "budget", "Rectangle budget exceeded.");
                });
                rectangles.push(...fragments);
            }
        });
        const corners = (r: Rect): Point[] => [[r.lo[0], r.lo[1]], [r.hi[0], r.lo[1]], [r.hi[0], r.hi[1]], [r.lo[0], r.hi[1]]].map(([u, v]) => { const p: Point = [0, 0, 0]; p[r.axis] = r.plane; p[r.u] = u!; p[r.v] = v!; return p; });
        const lineKey = (p: Point, axis: number): string => `${axis}:${p[(axis + 1) % 3]},${p[(axis + 2) % 3]}`;
        const lines = new Map<string, Set<number>>();
        for (const r of rectangles) {
            const points = corners(r);
            for (let i = 0; i < 4; i++) {
                const p = points[i]!; const q = points[(i + 1) % 4]!; const axis = p.findIndex((x, a) => x !== q[a]);
                const k = lineKey(p, axis); if (!lines.has(k)) lines.set(k, new Set());
                lines.get(k)!.add(p[axis]!); lines.get(k)!.add(q[axis]!);
            }
        }
        const sortedLines = new Map([...lines].map(([k, values]) => [k, [...values].sort((a, b) => a - b)]));
        const positions: number[] = []; const triangleFaces: number[] = [];
        for (const r of rectangles) {
            const points = corners(r); const boundary: Point[] = [];
            for (let i = 0; i < 4; i++) {
                const p = points[i]!; const q = points[(i + 1) % 4]!; const axis = p.findIndex((x, a) => x !== q[a]);
                const low = Math.min(p[axis]!, q[axis]!); const high = Math.max(p[axis]!, q[axis]!);
                const values = sortedLines.get(lineKey(p, axis))!.filter(value => value >= low && value <= high);
                if (p[axis]! > q[axis]!) values.reverse();
                for (const value of values.slice(0, -1)) { const next: Point = [...p]; next[axis] = value; boundary.push(next); }
            }
            const center = points[0]!.map((x, a) => x + (points[2]![a]! - x) / 2) as Point;
            for (let i = 0; i < boundary.length; i++) {
                const a = boundary[i]!; const b = boundary[(i + 1) % boundary.length]!;
                positions.push(...center, ...(r.sign > 0 ? a : b), ...(r.sign > 0 ? b : a)); triangleFaces.push(r.face);
                requireThat(triangleFaces.length <= MAX_TRIANGLES, "budget", "Triangle budget exceeded.");
            }
        }
        const component = { positions: new Float64Array(positions), triangleFaces: new Uint32Array(triangleFaces) };
        inspectUnionTopology(component, core.faces.length);
        component.positions = Float64Array.from(component.positions, (value, i) => origin[i % 3]! + value * side);
        // World-coordinate reconstruction must not collapse any previously distinct points.
        const check = { ...component, positions: Float64Array.from(component.positions, (value, i) => (value - origin[i % 3]!) / side) };
        inspectUnionTopology(check, core.faces.length);
        return { status: "valid", geometry: { ...component, components: [component] }, rectangles: rectangles.length };
    } catch (error) {
        if (!(error instanceof Rejection)) throw error;
        return { status: "rejected", diagnostic: { code: `three.display-union.${error.code}`, severity: "error", message: error.message } };
    }
}

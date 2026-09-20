import type { CrystalGeometry } from "@crystal/core";
import { BufferGeometry, Float32BufferAttribute } from "three";

/** Renderer-neutral, render-only triangles. `triangleFaces` always indexes core faces. */
export interface DisplayGrowthGeometry {
    readonly components: readonly DisplayGrowthComponent[];
    readonly positions: Float64Array;
    readonly triangleFaces: Uint32Array;
}

/** A closed portion of the display surface. The first preset has one component. */
export interface DisplayGrowthComponent {
    readonly positions: Float64Array;
    readonly triangleFaces: Uint32Array;
}

export interface WatertightnessResult { readonly ok: boolean; readonly message?: string; }

type Vec3 = readonly [number, number, number];
const point = (vertices: Float64Array, index: number): Vec3 => [vertices[index * 3]!, vertices[index * 3 + 1]!, vertices[index * 3 + 2]!];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v: Vec3): Vec3 => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length]; };
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: Vec3, value: number): Vec3 => [v[0] * value, v[1] * value, v[2] * value];
const key = (p: Vec3): string => `${p[0].toPrecision(15)},${p[1].toPrecision(15)},${p[2].toPrecision(15)}`;

/**
 * Validates a triangle soup as a closed two-manifold by welded coordinate edges.
 * This intentionally has no Three.js dependency so topology is checked before GPU conversion.
 */
export function validateWatertightDisplayComponent(component: DisplayGrowthComponent): WatertightnessResult {
    const edges = new Map<string, number>();
    for (let i = 0; i < component.positions.length; i += 9) {
        const triangle: Vec3[] = [0, 1, 2].map((offset) => [component.positions[i + offset * 3]!, component.positions[i + offset * 3 + 1]!, component.positions[i + offset * 3 + 2]!]);
        for (let edge = 0; edge < 3; edge++) {
            const a = key(triangle[edge]!); const b = key(triangle[(edge + 1) % 3]!);
            const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
            edges.set(edgeKey, (edges.get(edgeKey) ?? 0) + 1);
        }
    }
    const open = [...edges.values()].find((count) => count !== 2);
    return open === undefined ? { ok: true } : { ok: false, message: "Display component has an open or non-manifold edge." };
}

function pushTriangle(positions: number[], faces: number[], faceIndex: number, a: Vec3, b: Vec3, c: Vec3): void {
    positions.push(...a, ...b, ...c); faces.push(faceIndex);
}

/**
 * Creates the curated Terraced fluorite display surface. Only quadrilateral core
 * faces contributed by cube form `a` are replaced. Their common outer boundary is
 * retained exactly, so the complete replacement surface remains closed.
 */
function makeComponent(triangles: readonly { readonly faceIndex: number; readonly points: readonly [Vec3, Vec3, Vec3] }[]): DisplayGrowthComponent {
    const positions: number[] = []; const triangleFaces: number[] = [];
    for (const triangle of triangles) pushTriangle(positions, triangleFaces, triangle.faceIndex, ...triangle.points);
    return { positions: new Float64Array(positions), triangleFaces: new Uint32Array(triangleFaces) };
}

/** Keeps the closed core and adds closed cubic child-growth components on cube faces. */
export function createTerracedFluoriteDisplayGeometry(core: CrystalGeometry, seed = 0x5f3759df): DisplayGrowthGeometry {
    const coreTriangles: { faceIndex: number; points: [Vec3, Vec3, Vec3] }[] = [];
    const components: DisplayGrowthComponent[] = [];
    core.faces.forEach((face, faceIndex) => {
        for (let i = 1; i < face.vertexIndices.length - 1; i++) coreTriangles.push({ faceIndex, points: [point(core.vertices, face.vertexIndices[0]!), point(core.vertices, face.vertexIndices[i]!), point(core.vertices, face.vertexIndices[i + 1]!)] });
    });
    components.push(makeComponent(coreTriangles));
    core.faces.forEach((face, faceIndex) => {
        if (face.vertexIndices.length !== 4 || !face.contributors.some((contributor) => contributor.formId === "a")) return;
        const outer = face.vertexIndices.map((index) => point(core.vertices, index));
        const center = outer.reduce<Vec3>((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4, sum[2] + p[2] / 4], [0, 0, 0]);
        const u = normalize(sub(outer[1]!, outer[0]!)); const v = normalize(cross(face.normal, u));
        const side = Math.hypot(...sub(outer[1]!, outer[0]!));
        let state = (seed ^ Math.imul(faceIndex + 1, 0x9e3779b9)) >>> 0;
        const random = (): number => { state = (state + 0x6d2b79f5) >>> 0; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 0x1_0000_0000; };
        // A dense, face-covering field overlaps adjacent cells so it reads as one
        // surface. Seeded offset and footprint variation break the regular grid;
        // randomness is constrained enough to retain coherent stepped growth.
        const bias = random() * 2 - 1;
        const children = Array.from({ length: 81 }, (_, index) => {
            const column = index % 9; const row = Math.floor(index / 9);
            const uOffset = -0.44 + column * 0.11 + (random() - 0.5) * 0.092;
            const vOffset = -0.44 + row * 0.11 + (random() - 0.5) * 0.092;
            const radial = 1 - Math.max(Math.abs(uOffset), Math.abs(vOffset)) / 0.4;
            const tier = Math.max(0, Math.min(4, Math.round(radial * 2.2 + bias * 0.45 + (random() - 0.5) * 1.15)));
            const footprint = 0.078 + random() * 0.135;
            // Keep every attached child within its parent core face: no overhangs
            // or stray side artifacts at cube edges.
            const limit = 0.5 - footprint / 2;
            return [Math.max(-limit, Math.min(limit, uOffset)), Math.max(-limit, Math.min(limit, vOffset)), footprint, 0.014 + tier * 0.030 + random() * 0.012] as const;
        });
        for (const [uOffset, vOffset, footprint, height] of children) {
            const childCenter = add(center, add(scale(u, uOffset * side), scale(v, vOffset * side)));
            const half = footprint * side / 2;
            const corners = (origin: Vec3): readonly Vec3[] => [add(add(origin, scale(u, -half)), scale(v, -half)), add(add(origin, scale(u, half)), scale(v, -half)), add(add(origin, scale(u, half)), scale(v, half)), add(add(origin, scale(u, -half)), scale(v, half))];
            const back = corners(add(childCenter, scale(face.normal, -side * 0.002))); const front = corners(add(childCenter, scale(face.normal, height * side)));
            const quads = [[back[0]!, back[3]!, back[2]!, back[1]!], [front[0]!, front[1]!, front[2]!, front[3]!], [back[0]!, back[1]!, front[1]!, front[0]!], [back[1]!, back[2]!, front[2]!, front[1]!], [back[2]!, back[3]!, front[3]!, front[2]!], [back[3]!, back[0]!, front[0]!, front[3]!]] as const;
            components.push(makeComponent(quads.flatMap(([a, b, c, d]) => [{ faceIndex, points: [a, b, c] as [Vec3, Vec3, Vec3] }, { faceIndex, points: [a, c, d] as [Vec3, Vec3, Vec3] }])));
        }
    });
    for (const component of components) { const checked = validateWatertightDisplayComponent(component); if (!checked.ok) throw new Error(checked.message); }
    return { components, positions: new Float64Array(components.flatMap((component) => [...component.positions])), triangleFaces: new Uint32Array(components.flatMap((component) => [...component.triangleFaces])) };
}

/** Converts independently validated display geometry to a GPU buffer. */
export function createThreeDisplayGrowthGeometry(display: DisplayGrowthGeometry): BufferGeometry {
    const buffer = new BufferGeometry();
    const vertexCount = display.positions.length / 3;
    const coordinates = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i += 3) coordinates.set([0, 0, 1, 0, 0, 1], i * 2);
    buffer.setAttribute("position", new Float32BufferAttribute(display.positions, 3));
    buffer.setAttribute("surfaceTangent", new Float32BufferAttribute(new Float32Array(display.positions.length), 3));
    buffer.setAttribute("surfaceCoord", new Float32BufferAttribute(coordinates, 2));
    buffer.setAttribute("surfaceProfile", new Float32BufferAttribute(new Float32Array(vertexCount), 1));
    buffer.setAttribute("surfaceSeed", new Float32BufferAttribute(new Float32Array(vertexCount), 1));
    buffer.setIndex(Array.from({ length: vertexCount }, (_, index) => index));
    return buffer;
}

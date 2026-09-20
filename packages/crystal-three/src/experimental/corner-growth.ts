/** Owner-authorized SR10 experiment. No production export or renderer dependency. */
import type { CrystalGeometry } from "@crystal/core";
import type { DisplayGrowthComponent, DisplayGrowthGeometry } from "../display-growth.js";

type Point = [number, number, number];

/** Additional shallow boxes only; never mutates the accepted field or scientific core. */
export function createCornerGrowthOperands(core: CrystalGeometry, accepted: DisplayGrowthGeometry, seed = 0x5f3759df): readonly DisplayGrowthComponent[] {
    const side = core.bounds.max[0] - core.bounds.min[0];
    const faceBySide = Array.from({ length: 6 }, (_, slot) => core.faces.findIndex(face => face.normal.every((v, a) => Math.abs(v - (a === Math.floor(slot / 2) ? slot % 2 * 2 - 1 : 0)) < 1e-12)));
    if (faceBySide.includes(-1) || !accepted.components[0] || !Number.isFinite(side) || side <= 0) throw new Error("Corner growth requires an accepted cube field.");
    const children = accepted.components.slice(1).map(component => ({
        face: component.triangleFaces[0]!,
        min: [0, 1, 2].map(a => Math.min(...component.positions.filter((_, i) => i % 3 === a))),
        max: [0, 1, 2].map(a => Math.max(...component.positions.filter((_, i) => i % 3 === a))),
    }));
    children.sort((a, b) => {
        const left = [a.face, ...a.min, ...a.max]; const right = [b.face, ...b.min, ...b.max];
        for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i]! - right[i]!;
        return 0;
    });
    let state = (seed ^ 0x83d2e741) >>> 0;
    const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x1_0000_0000;
    };
    const plane = (slot: number): number => (slot % 2 ? core.bounds.max : core.bounds.min)[Math.floor(slot / 2)]!;
    // Exact existing top planes: nearest footprint, highest surface among ties.
    const neighborTop = (slot: number, target: Point): number => {
        const axis = Math.floor(slot / 2); const sign = slot % 2 ? 1 : -1;
        let nearest = Infinity; let height = 0;
        for (const child of children) {
            if (child.face !== faceBySide[slot]) continue;
            let distance = 0;
            for (let a = 0; a < 3; a++) if (a !== axis) distance += Math.max(child.min[a]! - target[a]!, target[a]! - child.max[a]!, 0) ** 2;
            const candidate = sign * ((sign > 0 ? child.max[axis]! : child.min[axis]!) - plane(slot));
            const tolerance = side * side * 1e-14;
            if (distance < nearest - tolerance) { nearest = distance; height = candidate; }
            else if (Math.abs(distance - nearest) <= tolerance) height = Math.max(height, candidate);
        }
        if (!Number.isFinite(nearest) || height <= 0 || height > side * 0.06) throw new Error("Corner growth needs shallow neighboring child heights.");
        return plane(slot) + sign * height;
    };
    const result: DisplayGrowthComponent[] = [];
    const add = (incident: number[], target: Point, min: Point, max: Point): void => {
        for (const slot of incident) {
            const axis = Math.floor(slot / 2); const inset = side * (0.068 + random() * 0.036);
            if (slot % 2) { min[axis] = plane(slot) - inset; max[axis] = neighborTop(slot, target); }
            else { min[axis] = neighborTop(slot, target); max[axis] = plane(slot) + inset; }
        }
        const fallback = Math.min(...incident.map(slot => faceBySide[slot]!));
        const positions: number[] = []; const triangleFaces: number[] = [];
        for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
            const slot = axis * 2 + (sign > 0 ? 1 : 0); const u = (axis + 1) % 3; const v = (axis + 2) % 3;
            const corners = [[min[u], min[v]], [max[u], min[v]], [max[u], max[v]], [min[u], max[v]]].map(([x, y]) => {
                const point: Point = [0, 0, 0]; point[axis] = sign > 0 ? max[axis]! : min[axis]!; point[u] = x!; point[v] = y!; return point;
            });
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
                positions.push(...corners[a!]!, ...corners[sign > 0 ? b! : c!]!, ...corners[sign > 0 ? c! : b!]!);
                triangleFaces.push(incident.includes(slot) ? faceBySide[slot]! : fallback);
            }
        }
        result.push({ positions: new Float64Array(positions), triangleFaces: new Uint32Array(triangleFaces) });
    };
    for (let along = 0; along < 3; along++) {
        const a = (along + 1) % 3; const b = (along + 2) % 3;
        for (const sa of [0, 1]) for (const sb of [0, 1]) for (let i = 0; i < 6; i++) {
            const incident = [a * 2 + sa, b * 2 + sb];
            const target: Point = [0, 0, 0]; target[a] = plane(incident[0]!); target[b] = plane(incident[1]!);
            // Six disjoint slots: bounded jitter and width guarantee visible gaps.
            target[along] = core.bounds.min[along]! + side * (0.14 + i * 0.144 + (random() - 0.5) * 0.008);
            const half = side * (0.046 + random() * 0.014);
            const min: Point = [...target]; const max: Point = [...target];
            min[along] = target[along]! - half; max[along] = target[along]! + half;
            add(incident, target, min, max);
        }
    }
    for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) {
        const incident = [sx, 2 + sy, 4 + sz]; const target = incident.map(plane) as Point;
        add(incident, target, [...target], [...target]);
    }
    return result;
}

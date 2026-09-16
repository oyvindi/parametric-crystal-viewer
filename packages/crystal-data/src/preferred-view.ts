import type { Diagnostic, Vec3 } from "@crystal/core";
import type { PreferredView } from "./types.js";

/** Angular tolerance after normalization, independent of vector magnitude. */
export const VIEW_DIRECTION_TOLERANCE = 1e-10;

export function unitDirection(value: Vec3): Vec3 {
    const scale = Math.max(...value.map(Math.abs));
    const scaled = value.map((v) => v / scale);
    const length = Math.hypot(...scaled);
    return scaled.map((v) => v / length) as unknown as Vec3;
}

export function projectedUp(direction: Vec3, up: Vec3): Vec3 | undefined {
    const normalized = unitDirection(up);
    const dot = normalized.reduce((sum, v, i) => sum + v * direction[i], 0);
    const projected = normalized.map((v, i) => v - dot * direction[i]) as unknown as Vec3;
    if (Math.hypot(...projected) <= VIEW_DIRECTION_TOLERANCE) return undefined;
    return unitDirection(projected);
}

export function validatePreferredView(value: unknown, path = "/preferredView"): readonly Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const error = (suffix: string) => diagnostics.push({ code: "data.record.invalid-preferred-view", severity: "error", message: "Preferred-view vectors must be finite, non-zero triples; up must not be parallel to the camera direction.", path: path + suffix });
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        error("");
        return diagnostics;
    }
    const view = value as PreferredView;
    const vector = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && Array.from(v).every(Number.isFinite) && v.some((n) => n !== 0);
    const directionValid = vector(view.cameraDirection);
    if (!directionValid) error("/cameraDirection");
    if (view.upDirection !== undefined) {
        if (!vector(view.upDirection) || (directionValid && !projectedUp(unitDirection(view.cameraDirection), view.upDirection))) error("/upDirection");
    }
    return diagnostics;
}

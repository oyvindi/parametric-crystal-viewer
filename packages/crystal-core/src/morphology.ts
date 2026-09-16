import type { Diagnostic } from "./diagnostics.js";
import { intersectHalfSpaces, type GeometryResult } from "./geometry.js";
import type { Lattice } from "./lattice.js";
import { expandEquivalentPlaneDirections } from "./planes.js";
import type { MillerIndices } from "./miller.js";
import type { PointOperation } from "./symmetry.js";

export interface CrystalFormSetting {
    readonly id: string;
    readonly indices: MillerIndices;
    readonly development: number;
}

export interface MorphologyInput {
    readonly lattice: Lattice;
    readonly operations: readonly PointOperation[];
    readonly forms: readonly CrystalFormSetting[];
    readonly morphologyScale?: number;
}

function invalid(code: string, message: string): GeometryResult {
    const diagnostic: Diagnostic = { code, severity: "error", message };
    return { status: "invalid", diagnostics: [diagnostic] };
}

/** Generates morphology from validated form directions and normalized support distances. */
export function generateCrystalGeometry(input: MorphologyInput): GeometryResult {
    const scale = input.morphologyScale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) return invalid("core.input.invalid-morphology-scale", "Morphology scale must be finite and positive.");
    if (input.forms.some((form) => !Number.isFinite(form.development) || form.development < 0 || form.development > 1)) return invalid("core.input.invalid-development", "Form development must be finite and within [0, 1].");
    const active = input.forms.filter((form) => form.development > 0);
    if (active.length === 0) return invalid("core.geometry.no-active-forms", "No forms have positive development.");
    const planes = [] as { id: string; normal: readonly [number, number, number]; distance: number; contributors: readonly { formId: string; operationIds: readonly string[] }[] }[];
    for (const form of active) {
        const directions = expandEquivalentPlaneDirections(form.indices, input.operations, input.lattice);
        if (!directions.ok) return { status: "invalid", diagnostics: directions.diagnostics };
        for (const direction of directions.value) planes.push({ id: `${form.id}:${direction.indices.h},${direction.indices.k},${direction.indices.l}`, normal: direction.normal, distance: 1 / form.development, contributors: [{ formId: form.id, operationIds: direction.operationIds }] });
    }
    const result = intersectHalfSpaces(planes);
    if (result.status !== "valid" || scale === 1) return result;
    const vertices = new Float64Array(result.geometry.vertices.length);
    result.geometry.vertices.forEach((value, index) => { vertices[index] = value * scale; });
    const { min, max } = result.geometry.bounds;
    return { status: "valid", diagnostics: [], geometry: { ...result.geometry, vertices, bounds: { min: [min[0] * scale, min[1] * scale, min[2] * scale], max: [max[0] * scale, max[1] * scale, max[2] * scale] } } };
}

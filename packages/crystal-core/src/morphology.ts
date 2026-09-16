import type { Diagnostic } from "./diagnostics.js";
import { intersectHalfSpaces, type GeometryResult, type HalfSpace } from "./geometry.js";
import type { Lattice } from "./lattice.js";
import { expandEquivalentPlaneDirections } from "./planes.js";
import { validateMillerIndices, type CrystalSystem, type MillerIndices } from "./miller.js";
import { validatePointOperations, type PointOperation } from "./symmetry.js";

export interface CrystalFormSetting {
    readonly id: string;
    readonly label?: string;
    readonly indices: MillerIndices;
    readonly development: number;
    /** Omitted means enabled. */
    readonly enabled?: boolean;
}

export interface MorphologyInput {
    readonly lattice: Lattice;
    readonly operations: readonly PointOperation[];
    readonly forms: readonly CrystalFormSetting[];
    readonly morphologyScale?: number;
    readonly crystalSystem?: CrystalSystem;
}

export function validateMorphology(forms: readonly CrystalFormSetting[], scale: number, crystalSystem?: CrystalSystem): readonly Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const add = (code: string, message: string, path: string, formId?: string) => diagnostics.push({ code, severity: "error", message, path, ...(formId ? { formIds: [formId] } : {}) });
    if (!Number.isFinite(scale) || scale <= 0) add("core.input.invalid-morphology-scale", "Morphology scale must be finite and positive.", "/morphologyScale");
    const ids = new Set<string>();
    forms.forEach((form, index) => {
        const path = `/forms/${index}`;
        if (!form.id || ids.has(form.id)) add("core.input.invalid-form", "Form IDs must be non-empty and unique.", `${path}/id`, form.id);
        ids.add(form.id);
        if (form.enabled !== undefined && typeof form.enabled !== "boolean") add("core.input.invalid-form", "Enabled must be boolean.", `${path}/enabled`, form.id);
        if (!Number.isFinite(form.development) || form.development < 0 || form.development > 1 || (form.development > 0 && !Number.isFinite(1 / form.development))) add("core.input.invalid-development", "Development must be in [0, 1] and positive values must have finite reciprocal support.", `${path}/development`, form.id);
        const indices = validateMillerIndices(form.indices, { crystalSystem });
        if (!indices.ok) diagnostics.push(...indices.diagnostics.map((d) => ({ ...d, path: `${path}/indices${d.path ?? ""}`, formIds: [form.id] })));
    });
    return diagnostics;
}

/** Lower-level entry point for a constructed lattice; output is centered on the unit cell. */
export function generateCrystalGeometry(input: MorphologyInput): GeometryResult {
    const scale = input.morphologyScale ?? 1;
    const diagnostics = [...validateMorphology(input.forms, scale, input.crystalSystem)];
    const symmetry = validatePointOperations(input.operations, input.lattice);
    diagnostics.push(...symmetry.diagnostics);
    if (diagnostics.some((d) => d.severity === "error")) return { status: "invalid", diagnostics };
    const active = input.forms.filter((form) => form.enabled !== false && form.development > 0);
    const planes: HalfSpace[] = [];
    for (const form of [...active].sort((a, b) => a.id.localeCompare(b.id))) {
        const directions = expandEquivalentPlaneDirections(form.indices, input.operations, input.lattice);
        if (!directions.ok) { diagnostics.push(...directions.diagnostics.map((d) => ({ ...d, formIds: [form.id] }))); continue; }
        for (const direction of directions.value) planes.push({ id: `${form.id}:${direction.indices.h},${direction.indices.k},${direction.indices.l}`, normal: direction.normal, distance: 1 / form.development, contributors: [{ formId: form.id, indices: direction.indices, operationIds: direction.operationIds }] });
    }
    if (diagnostics.some((d) => d.severity === "error")) return { status: "invalid", diagnostics };
    const result = intersectHalfSpaces(planes);
    if (result.status !== "valid") return { ...result, diagnostics: result.diagnostics.map((d) => ({ ...d, formIds: active.map((f) => f.id).sort() })) };
    const visible = new Set(result.geometry.faces.flatMap((face) => face.contributors.map((c) => c.formId)));
    for (const form of [...active].sort((a, b) => a.id.localeCompare(b.id))) if (!visible.has(form.id)) diagnostics.push({ code: "core.geometry.redundant-form", severity: "warning", message: "Active form contributes no visible boundary at these settings.", formIds: [form.id] });
    const origin = input.lattice.direct.map((row) => row.reduce((sum, x) => sum + x / 2, 0));
    const vertices = result.geometry.vertices.map((value, index) => value * scale + origin[index % 3]!);
    const min = result.geometry.bounds.min.map((x, i) => x * scale + origin[i]!) as [number, number, number];
    const max = result.geometry.bounds.max.map((x, i) => x * scale + origin[i]!) as [number, number, number];
    if (!vertices.every(Number.isFinite) || min.some((x, i) => !Number.isFinite(x) || !Number.isFinite(max[i]) || x >= max[i]!)) return { status: "invalid", diagnostics: [{ code: "core.geometry.numerical-failure", severity: "error", message: "Scaled geometry cannot be represented reliably at the unit-cell center." }] };
    return { status: "valid", diagnostics, geometry: { ...result.geometry, vertices, bounds: { min, max } } };
}

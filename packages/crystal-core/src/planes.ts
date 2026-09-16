import type { Diagnostic, Result } from "./diagnostics.js";
import type { Lattice, Vec3 } from "./lattice.js";
import { transformMillerIndices, type MillerIndices } from "./miller.js";
import type { PointOperation } from "./symmetry.js";

export interface EquivalentPlaneDirection {
    readonly indices: Extract<MillerIndices, { readonly notation: "miller" }>;
    readonly normal: Vec3;
    readonly operationIds: readonly string[];
}

function invalid(message: string): Result<never> {
    const diagnostic: Diagnostic = { code: "core.input.invalid-miller-indices", severity: "error", message };
    return { ok: false, diagnostics: [diagnostic] };
}

function normalFor(indices: Extract<MillerIndices, { readonly notation: "miller" }>, lattice: Lattice): Vec3 | undefined {
    const vector: Vec3 = [
        lattice.reciprocal[0][0] * indices.h + lattice.reciprocal[0][1] * indices.k + lattice.reciprocal[0][2] * indices.l,
        lattice.reciprocal[1][0] * indices.h + lattice.reciprocal[1][1] * indices.k + lattice.reciprocal[1][2] * indices.l,
        lattice.reciprocal[2][0] * indices.h + lattice.reciprocal[2][1] * indices.k + lattice.reciprocal[2][2] * indices.l,
    ];
    const length = Math.hypot(...vector);
    return Number.isFinite(length) && length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : undefined;
}

/** Expands a three-index form into its unique oriented Cartesian plane directions. */
export function expandEquivalentPlaneDirections(
    indices: MillerIndices,
    operations: readonly PointOperation[],
    lattice: Lattice,
): Result<readonly EquivalentPlaneDirection[]> {
    if (indices.notation !== "miller") return invalid("Miller–Bravais plane expansion is deferred until M3.");
    const result = new Map<string, EquivalentPlaneDirection>();
    for (const operation of operations) {
        const transformed = transformMillerIndices(indices, operation.linear);
        if (!transformed.ok || transformed.value.notation !== "miller") return transformed as Result<never>;
        const normal = normalFor(transformed.value, lattice);
        if (!normal) return invalid("Miller indices produced an invalid Cartesian plane normal.");
        const key = `${transformed.value.h},${transformed.value.k},${transformed.value.l}`;
        const existing = result.get(key);
        result.set(key, existing
            ? { ...existing, operationIds: [...existing.operationIds, operation.id].sort() }
            : { indices: transformed.value, normal, operationIds: [operation.id] });
    }
    return { ok: true, value: [...result.values()].sort((a, b) => a.indices.h - b.indices.h || a.indices.k - b.indices.k || a.indices.l - b.indices.l), diagnostics: [] };
}

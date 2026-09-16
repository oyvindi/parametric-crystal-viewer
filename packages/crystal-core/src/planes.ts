import type { Diagnostic, Result } from "./diagnostics.js";
import type { Lattice, Vec3 } from "./lattice.js";
import { transformMillerIndices, millerBravaisToMiller, type MillerIndices } from "./miller.js";
import type { PointOperation } from "./symmetry.js";

export interface EquivalentPlaneDirection {
    readonly indices: MillerIndices;
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

/** Expands a form into its unique oriented Cartesian plane directions. */
export function expandEquivalentPlaneDirections(
    indices: MillerIndices,
    operations: readonly PointOperation[],
    lattice: Lattice,
): Result<readonly EquivalentPlaneDirection[]> {
    const result = new Map<string, EquivalentPlaneDirection>();
    for (const operation of operations) {
        const transformed = transformMillerIndices(indices, operation.linear);
        if (!transformed.ok) return transformed as Result<never>;
        const threeIndex = transformed.value.notation === "miller" ? transformed.value : millerBravaisToMiller(transformed.value);
        const normal = normalFor(threeIndex, lattice);
        if (!normal) return invalid("Miller indices produced an invalid Cartesian plane normal.");
        const key = `${threeIndex.h},${threeIndex.k},${threeIndex.l}`;
        const existing = result.get(key);
        result.set(key, existing
            ? { ...existing, operationIds: [...existing.operationIds, operation.id].sort() }
            : { indices: transformed.value, normal, operationIds: [operation.id] });
    }
    const sorted = [...result.values()].sort((a, b) => {
        const ah = a.indices.notation === "miller" ? a.indices.h : a.indices.h;
        const bh = b.indices.notation === "miller" ? b.indices.h : b.indices.h;
        const ak = a.indices.notation === "miller" ? a.indices.k : a.indices.k;
        const bk = b.indices.notation === "miller" ? b.indices.k : b.indices.k;
        const al = a.indices.notation === "miller" ? a.indices.l : a.indices.l;
        const bl = b.indices.notation === "miller" ? b.indices.l : b.indices.l;
        return ah - bh || ak - bk || al - bl;
    });
    return { ok: true, value: sorted, diagnostics: [] };
}

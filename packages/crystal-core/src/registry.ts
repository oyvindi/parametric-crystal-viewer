import { CUBIC_OPERATIONS } from "./registry/cubic-operations.js";
import { REGISTRY_INTEGRITY } from "./registry/integrity.js";
import type { PointOperation } from "./symmetry.js";

export interface PointOperationRegistryEntry {
    readonly id: "point-group:m-3m:standard";
    readonly pointGroup: "m-3m";
    readonly setting: "cubic-standard";
    readonly operations: readonly PointOperation[];
    readonly source: {
        readonly name: "spglib";
        readonly version: "v2.7.0";
        readonly commit: "12355c77fb7c505a55f52cae36341d73b781a065";
        readonly license: "BSD-3-Clause";
    };
    readonly integrity: typeof REGISTRY_INTEGRITY;
    readonly normalization: "Decoded spglib Hall 517 rotations; translations discarded; ordered as signed permutation matrices.";
}

const CUBIC_M_3_M: PointOperationRegistryEntry = {
    id: "point-group:m-3m:standard",
    pointGroup: "m-3m",
    setting: "cubic-standard",
    operations: CUBIC_OPERATIONS,
    source: {
        name: "spglib",
        version: "v2.7.0",
        commit: "12355c77fb7c505a55f52cae36341d73b781a065",
        license: "BSD-3-Clause",
    },
    integrity: REGISTRY_INTEGRITY,
    normalization: "Decoded spglib Hall 517 rotations; translations discarded; ordered as signed permutation matrices.",
};

// Prevent a consumer from corrupting shared registry data for later calls.
for (const operation of CUBIC_OPERATIONS) {
    operation.linear.forEach(Object.freeze);
    Object.freeze(operation.linear);
    Object.freeze(operation);
}
Object.freeze(CUBIC_OPERATIONS);
Object.freeze(CUBIC_M_3_M.source);
Object.freeze(REGISTRY_INTEGRITY);
Object.freeze(CUBIC_M_3_M);

export function getPointOperationRegistryEntry(id: string): PointOperationRegistryEntry | undefined {
    return id === CUBIC_M_3_M.id ? CUBIC_M_3_M : undefined;
}

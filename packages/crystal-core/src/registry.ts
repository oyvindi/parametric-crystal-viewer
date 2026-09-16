import { CUBIC_OPERATIONS } from "./registry/cubic-operations.js";
import { REGISTRY_INTEGRITY } from "./registry/integrity.js";
import { TRIGONAL_32_OPERATIONS } from "./registry/trigonal-operations.js";
import { TRIGONAL_32_INTEGRITY } from "./registry/trigonal-integrity.js";
import type { PointOperation } from "./symmetry.js";

export interface PointOperationRegistryEntry {
    readonly id: string;
    readonly pointGroup: string;
    readonly setting: string;
    readonly operations: readonly PointOperation[];
    readonly source: {
        readonly name: "spglib";
        readonly version: "v2.7.0";
        readonly commit: "12355c77fb7c505a55f52cae36341d73b781a065";
        readonly license: "BSD-3-Clause";
    };
    readonly integrity: {
        readonly sourceSha256: string;
        readonly artifactSha256: string;
        readonly hallNumber: number;
        readonly spaceGroupNumber: number;
        readonly basis: string;
        readonly generator: string;
    };
    readonly normalization: string;
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

const TRIGONAL_32: PointOperationRegistryEntry = {
    id: "point-group:32:hexagonal",
    pointGroup: "32",
    setting: "hexagonal-standard",
    operations: TRIGONAL_32_OPERATIONS,
    source: {
        name: "spglib",
        version: "v2.7.0",
        commit: "12355c77fb7c505a55f52cae36341d73b781a065",
        license: "BSD-3-Clause",
    },
    integrity: TRIGONAL_32_INTEGRITY,
    normalization: "Decoded spglib Hall 441 (P3_121, sg 152) rotations; translations discarded; deduplicated to point group 32.",
};

// Prevent a consumer from corrupting shared registry data for later calls.
for (const operations of [CUBIC_OPERATIONS, TRIGONAL_32_OPERATIONS]) {
    for (const operation of operations) {
        operation.linear.forEach(Object.freeze);
        Object.freeze(operation.linear);
        Object.freeze(operation);
    }
    Object.freeze(operations);
}
Object.freeze(CUBIC_M_3_M.source);
Object.freeze(REGISTRY_INTEGRITY);
Object.freeze(CUBIC_M_3_M);
Object.freeze(TRIGONAL_32.source);
Object.freeze(TRIGONAL_32_INTEGRITY);
Object.freeze(TRIGONAL_32);

const ENTRIES = Object.freeze([CUBIC_M_3_M, TRIGONAL_32]);
const BY_ID = new Map(ENTRIES.map((entry) => [entry.id, entry]));

export function getPointOperationRegistryEntry(id: string): PointOperationRegistryEntry | undefined {
    return BY_ID.get(id);
}

export function listPointOperationRegistryEntries(): readonly PointOperationRegistryEntry[] {
    return ENTRIES;
}

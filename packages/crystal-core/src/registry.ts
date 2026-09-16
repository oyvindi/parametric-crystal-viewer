import type { Mat3, Vec3 } from "./lattice.js";
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
    readonly normalization: "Generated signed permutation matrices in the project row-major fractional convention.";
}

const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

function signedPermutationMatrices(): readonly PointOperation[] {
    const operations: PointOperation[] = [];
    for (const permutation of PERMUTATIONS) {
        for (const sx of [-1, 1] as const) for (const sy of [-1, 1] as const) for (const sz of [-1, 1] as const) {
            const signs = [sx, sy, sz] as const;
            const rows = permutation.map((column, row) => {
                const values: [number, number, number] = [0, 0, 0];
                values[column] = signs[row];
                return values;
            }) as unknown as Mat3;
            operations.push({ id: `m-3m-${operations.length.toString().padStart(2, "0")}`, linear: rows });
        }
    }
    return operations;
}

const CUBIC_M_3_M: PointOperationRegistryEntry = {
    id: "point-group:m-3m:standard",
    pointGroup: "m-3m",
    setting: "cubic-standard",
    operations: signedPermutationMatrices(),
    source: {
        name: "spglib",
        version: "v2.7.0",
        commit: "12355c77fb7c505a55f52cae36341d73b781a065",
        license: "BSD-3-Clause",
    },
    normalization: "Generated signed permutation matrices in the project row-major fractional convention.",
};

export function getPointOperationRegistryEntry(id: string): PointOperationRegistryEntry | undefined {
    return id === CUBIC_M_3_M.id ? CUBIC_M_3_M : undefined;
}

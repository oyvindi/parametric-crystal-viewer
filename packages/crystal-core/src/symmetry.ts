import type { Diagnostic, Result } from "./diagnostics.js";
import type { Lattice, Mat3, Vec3 } from "./lattice.js";
import { getPointOperationRegistryEntry } from "./registry.js";

export interface PointOperation {
    readonly id: string;
    readonly linear: Mat3;
}

export interface SpaceOperation extends PointOperation {
    readonly translation: Vec3;
}

export interface PointSymmetryInput {
    readonly registryId?: string;
    readonly operations?: readonly PointOperation[];
    readonly identityOnly?: boolean;
}

const TOLERANCE = 1e-10;
const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function diagnostic(code: string, message: string, operationIds?: readonly string[]): Result<never> {
    const item: Diagnostic = { code, severity: "error", message, operationIds };
    return { ok: false, diagnostics: [item] };
}

function multiply(left: Mat3, right: Mat3): Mat3 {
    const entry = (row: number, column: number): number =>
        left[row]![0] * right[0][column]! + left[row]![1] * right[1][column]! + left[row]![2] * right[2][column]!;
    return [
        [entry(0, 0), entry(0, 1), entry(0, 2)],
        [entry(1, 0), entry(1, 1), entry(1, 2)],
        [entry(2, 0), entry(2, 1), entry(2, 2)],
    ];
}

function transpose(matrix: Mat3): Mat3 {
    return [[matrix[0][0], matrix[1][0], matrix[2][0]], [matrix[0][1], matrix[1][1], matrix[2][1]], [matrix[0][2], matrix[1][2], matrix[2][2]]];
}

function equal(left: Mat3, right: Mat3): boolean {
    return left.every((row, rowIndex) => row.every((value, columnIndex) => Math.abs(value - right[rowIndex]![columnIndex]!) <= TOLERANCE));
}

function isFiniteMatrix(matrix: Mat3): boolean {
    return matrix.every((row) => row.every(Number.isFinite));
}

/** Validates group laws and the fractional-basis metric compatibility of point operations. */
export function validatePointOperations(operations: readonly PointOperation[], lattice: Lattice): Result<readonly PointOperation[]> {
    if (operations.length === 0) return diagnostic("core.symmetry.empty-operations", "At least one point operation is required.");
    const ids = new Set<string>();
    for (const operation of operations) {
        if (!operation.id || ids.has(operation.id)) {
            return diagnostic("core.symmetry.invalid-operation", "Point-operation IDs must be non-empty and unique.", [operation.id]);
        }
        ids.add(operation.id);
        if (!isFiniteMatrix(operation.linear)) {
            return diagnostic("core.symmetry.invalid-operation", "Point-operation matrices must contain finite values.", [operation.id]);
        }
        const transformedMetric = multiply(multiply(transpose(operation.linear), lattice.metric), operation.linear);
        if (!equal(transformedMetric, lattice.metric)) {
            return diagnostic("core.symmetry.metric-incompatible", "Point operation is incompatible with the unit-cell metric.", [operation.id]);
        }
    }
    if (!operations.some((operation) => equal(operation.linear, IDENTITY))) {
        return diagnostic("core.symmetry.missing-identity", "Point-operation set must contain identity.");
    }
    for (const operation of operations) {
        const hasInverse = operations.some((candidate) => equal(multiply(operation.linear, candidate.linear), IDENTITY));
        if (!hasInverse) return diagnostic("core.symmetry.missing-inverse", "Point-operation set must contain every inverse.", [operation.id]);
        for (const candidate of operations) {
            const composition = multiply(operation.linear, candidate.linear);
            if (!operations.some((member) => equal(member.linear, composition))) {
                return diagnostic("core.symmetry.not-closed", "Point-operation set must be closed under composition.", [operation.id, candidate.id]);
            }
        }
    }
    return { ok: true, value: operations, diagnostics: [] };
}

function sameOperationSet(left: readonly PointOperation[], right: readonly PointOperation[]): boolean {
    return left.length === right.length && left.every((operation) => right.some((candidate) => equal(operation.linear, candidate.linear)));
}

/** Resolves one explicit, registry, or deliberately identity-only point-operation description. */
export function resolvePointOperations(input: PointSymmetryInput, lattice: Lattice): Result<readonly PointOperation[]> {
    const supplied = Number(Boolean(input.registryId)) + Number(Boolean(input.operations)) + Number(Boolean(input.identityOnly));
    if (supplied === 0) return diagnostic("core.symmetry.missing", "A symmetry description is required; identity-only symmetry must be explicit.");
    if (input.identityOnly && supplied > 1) return diagnostic("core.symmetry.conflicting-descriptions", "Identity-only symmetry cannot be combined with another symmetry description.");
    if (input.identityOnly) return validatePointOperations([{ id: "identity", linear: IDENTITY }], lattice);

    const registry = input.registryId ? getPointOperationRegistryEntry(input.registryId) : undefined;
    if (input.registryId && !registry) return diagnostic("core.symmetry.unsupported-registry", "Unsupported symmetry registry identifier.");
    if (registry && input.operations && !sameOperationSet(registry.operations, input.operations)) {
        return diagnostic("core.symmetry.conflicting-descriptions", "Explicit operations do not agree with the registry entry.");
    }
    return validatePointOperations(input.operations ?? registry!.operations, lattice);
}

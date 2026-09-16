import type { Diagnostic, Result } from "@crystal/core";

/** Stable data-layer codes; scientific failures retain their core.* codes. */
export type DataDiagnosticCode =
    | "data.record.invalid-field"
    | "data.record.duplicate-id"
    | "data.record.invalid-reference"
    | "data.record.invalid-provenance"
    | "data.record.invalid-preferred-view"
    | "data.catalog.unknown-mineral"
    | "data.request.unknown-habit"
    | "data.request.unknown-variant"
    | "data.request.unknown-form"
    | "data.cif.parse"
    | "data.cif.missing-block"
    | "data.cif.unsupported-version"
    | "data.cif.unsupported-construct"
    | "data.cif.missing-required"
    | "data.cif.missing-operations"
    | "data.cif.unsupported-symmetry"
    | "data.cif.conflicting-symmetry"
    | "data.cif.ambiguous-site-representation"
    | "data.cif.ambiguous-block"
    | "data.cif.invalid-site"
    | "data.cif.bonds-omitted";

export class MineralDataError extends Error {
    constructor(readonly diagnostics: readonly Diagnostic[]) {
        super(diagnostics.map((d) => d.message).join(" "));
        this.name = "MineralDataError";
    }
}

export function dataError(code: DataDiagnosticCode, message: string, path: string): MineralDataError {
    return new MineralDataError([{ code, severity: "error", message, path }]);
}

export function unwrapData<T>(result: Result<T>): T {
    if (!result.ok) throw new MineralDataError(result.diagnostics);
    return result.value;
}

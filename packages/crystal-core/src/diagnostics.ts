/** A JSON-compatible diagnostic emitted by a renderer-neutral core operation. */
export interface Diagnostic {
    readonly code: string;
    readonly severity: "warning" | "error";
    readonly message: string;
    readonly path?: string;
    readonly details?: Readonly<Record<string, unknown>>;
}

export type Result<T> =
    | { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] }
    | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

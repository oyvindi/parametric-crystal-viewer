/**
 * Viewer state serialization (M7).
 *
 * State is JSON-compatible and versioned. Version 2 adds the `camera.projection`
 * field (`"perspective" | "orthographic"`). Version 1 is accepted on restore and
 * migrated: it defaults to `"perspective"` (the only projection V1 supported) and
 * is normalized to version 2 internally. The viewer owns serialization in
 * `crystal-viewer`; the shape validation here is pure so `setState` can reject
 * malformed payloads before any mutation.
 *
 * Open decisions resolved (see docs/decisions/0004-viewer-state-serialization.md
 * and docs/decisions/0012-orthographic-projection.md):
 * - Version identifiers: a single integer `version`. V2 ships version 2.
 * - Migration policy: version 1 is migrated on restore (projection defaults to
 *   `"perspective"`); no other v1 field changes. Unsupported versions are rejected.
 * - Referenced-data compatibility: bundled minerals are referenced by id +
 *   dataRevision; the viewer verifies the revision on restore. Imported
 *   structures are embedded in full (portable, provenance preserved).
 * - Face selection: not persistent. It is transient (depends on the rendered
 *   mesh), so it is excluded like pointer hover and animation handles.
 */
import type { Diagnostic } from "@crystal/core";
import type { Mineral, StructuralDefinition } from "@crystal/data";

export const STATE_VERSION = 3 as const;

/** Supported camera projections. Version 1 only supported `"perspective"`. */
export type CameraProjection = "perspective" | "orthographic";

export type ViewMode = "morphology" | "atomic";

export interface FormState {
    readonly development: number;
    readonly enabled: boolean;
}

export interface DisplayState {
    readonly axes: boolean;
    readonly labels: boolean;
    readonly unitCell: boolean;
    readonly bonds: boolean;
    readonly wireframe: boolean;
}

export interface CameraState {
    /** Camera projection. Omitted by legacy V1 states (defaults to `"perspective"`). */
    readonly projection?: CameraProjection;
    readonly position: readonly [number, number, number];
    readonly up: readonly [number, number, number];
    /** Defaults to the origin for V1 states written before this field existed. */
    readonly target?: readonly [number, number, number];
    /** Camera zoom; defaults to 1 for legacy V1 states. */
    readonly zoom?: number;
    /**
     * Unzoomed world-space frustum height (top − bottom at zoom 1) for the
     * orthographic projection; the analog of the perspective camera's fixed FOV.
     * Omitted by perspective and legacy V1 states. Restore sizes the orthographic
     * frustum directly from this value instead of re-deriving it from geometry.
     */
    readonly frustumHeight?: number;
    readonly near: number;
    readonly far: number;
    readonly groupRotation: readonly [number, number, number];
}

export interface AtomicState {
    readonly viewMode: ViewMode;
    readonly latticeRepetition: readonly [number, number, number];
}

export interface MineralRefState {
    readonly id: string;
    readonly dataRevision: string;
    readonly variant?: string;
    /** Full validated definition for a caller-supplied mineral outside the bundled catalog. */
    readonly definition?: Mineral;
}

export interface StructureState {
    readonly definition: StructuralDefinition;
}

/** User overrides on top of a selected appearance preset (V1 fields only). */
export interface AppearanceOverride {
    readonly baseColor?: string;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly transmission?: number;
    readonly ior?: number;
    readonly absorptionColor?: string;
    readonly absorptionDensity?: number;
}

/** Serialized appearance: the selected preset and any user overrides. */
export interface AppearanceState {
    readonly id?: string;
    readonly overrides?: AppearanceOverride;
}

/** Generic artistic surface detail. Legacy version-1 states omit it and restore off. */
export interface SurfaceDetailState {
    readonly enabled: boolean;
    readonly strength: number;
}

/** Render-only morphology selection. `idealized` is the scientific default. */
export type DisplayGrowthMode = "idealized" | "terraced-fluorite";

export interface ViewerState {
    /** Version 3 is current; versions 1 and 2 are accepted and migrated. */
    readonly version: 1 | 2 | 3;
    readonly mineral?: MineralRefState;
    readonly habit?: string;
    readonly forms: Readonly<Record<string, FormState>>;
    readonly morphologyScale?: number;
    readonly appearance?: AppearanceState;
    readonly surfaceDetail?: SurfaceDetailState;
    readonly displayGrowth?: DisplayGrowthMode;
    /** Optional unsigned 32-bit procedural seed for the display-growth realization. */
    readonly displayGrowthSeed?: number;
    readonly display: DisplayState;
    readonly camera: CameraState;
    readonly atomic: AtomicState;
    readonly structure?: StructureState;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isBool(value: unknown): value is boolean {
    return typeof value === "boolean";
}

function diag(code: string, message: string, path?: string): Diagnostic {
    return { code, severity: "error", message, ...(path !== undefined ? { path } : {}) };
}

/** Returns null on success, or diagnostics on failure. */
function expectVec3(value: unknown, path: string, code: string): readonly Diagnostic[] | null {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(isNumber)) {
        return [diag(code, `Expected a 3-element finite-number array at ${path}.`, path)];
    }
    return null;
}

/**
 * Validates the envelope shape of a serialized viewer state without touching
 * referenced data. Returns the typed state or diagnostics. Structural
 * definitions are checked for object shape only; the viewer re-validates and
 * re-expands them before committing.
 */
export function validateStateShape(input: unknown): { ok: true; value: ViewerState } | { ok: false; diagnostics: readonly Diagnostic[] } {
    const diagnostics: Diagnostic[] = [];
    if (!isObject(input)) return { ok: false, diagnostics: [diag("viewer.state.malformed", "State must be a JSON object.", "")] };
    const sourceVersion = input["version"];
    if (sourceVersion !== 1 && sourceVersion !== 2 && sourceVersion !== 3) {
        return { ok: false, diagnostics: [diag("viewer.state.unsupported-version", `Unsupported state version ${String(sourceVersion)}; supported versions are 1 through ${STATE_VERSION}.`, "/version")] };
    }

    // Migrate version 1 to version 2 without modifying the caller's payload.
    // This permits immutable state stores and keeps validation pure.
    const normalized: Record<string, unknown> = sourceVersion < 3
        ? {
            ...input,
            version: 3,
            camera: isObject(input["camera"])
                ? { ...input["camera"], projection: input["camera"]["projection"] ?? "perspective" }
                : input["camera"],
            displayGrowth: "idealized",
        }
        : input;

    const legacyCamera = sourceVersion === 1 && isObject(input["camera"]) ? input["camera"] : undefined;
    if (legacyCamera?.["projection"] !== undefined && legacyCamera["projection"] !== "perspective") {
        diagnostics.push(diag("viewer.state.malformed", "version 1 camera.projection must be 'perspective' when present.", "/camera/projection"));
    }
    if (legacyCamera?.["frustumHeight"] !== undefined) {
        diagnostics.push(diag("viewer.state.malformed", "version 1 camera.frustumHeight is unsupported.", "/camera/frustumHeight"));
    }

    const mineral = normalized["mineral"];
    if (mineral !== undefined) {
        if (!isObject(mineral)) diagnostics.push(diag("viewer.state.malformed", "mineral must be an object.", "/mineral"));
        else {
            if (!isString(mineral["id"])) diagnostics.push(diag("viewer.state.malformed", "mineral.id must be a string.", "/mineral/id"));
            if (!isString(mineral["dataRevision"])) diagnostics.push(diag("viewer.state.malformed", "mineral.dataRevision must be a string.", "/mineral/dataRevision"));
            if (mineral["variant"] !== undefined && !isString(mineral["variant"])) diagnostics.push(diag("viewer.state.malformed", "mineral.variant must be a string.", "/mineral/variant"));
            if (mineral["definition"] !== undefined && !isObject(mineral["definition"])) diagnostics.push(diag("viewer.state.malformed", "mineral.definition must be an object.", "/mineral/definition"));
        }
    }

    if (normalized["habit"] !== undefined && !isString(normalized["habit"])) diagnostics.push(diag("viewer.state.malformed", "habit must be a string.", "/habit"));

    const forms = normalized["forms"];
    if (!isObject(forms)) {
        diagnostics.push(diag("viewer.state.malformed", "forms must be an object.", "/forms"));
    } else {
        for (const [id, entry] of Object.entries(forms)) {
            if (!isObject(entry) || !isNumber(entry["development"]) || !isBool(entry["enabled"])) {
                diagnostics.push(diag("viewer.state.malformed", `forms.${id} must be { development: number, enabled: boolean }.`, `/forms/${id}`));
            }
        }
    }

    if (normalized["morphologyScale"] !== undefined && !isNumber(normalized["morphologyScale"])) diagnostics.push(diag("viewer.state.malformed", "morphologyScale must be a number.", "/morphologyScale"));

    const appearance = normalized["appearance"];
    if (appearance !== undefined) {
        if (!isObject(appearance)) {
            diagnostics.push(diag("viewer.state.malformed", "appearance must be an object.", "/appearance"));
        } else {
            if (appearance["id"] !== undefined && !isString(appearance["id"])) diagnostics.push(diag("viewer.state.malformed", "appearance.id must be a string.", "/appearance/id"));
            const overrides = appearance["overrides"];
            if (overrides !== undefined) {
                if (!isObject(overrides)) {
                    diagnostics.push(diag("viewer.state.malformed", "appearance.overrides must be an object.", "/appearance/overrides"));
                } else {
                    for (const key of ["baseColor", "absorptionColor"] as const) {
                        if (overrides[key] !== undefined && !isString(overrides[key])) diagnostics.push(diag("viewer.state.malformed", `appearance.overrides.${key} must be a string.`, `/appearance/overrides/${key}`));
                    }
                    for (const key of ["roughness", "metalness", "transmission", "ior", "absorptionDensity"] as const) {
                        if (overrides[key] !== undefined && !isNumber(overrides[key])) diagnostics.push(diag("viewer.state.malformed", `appearance.overrides.${key} must be a number.`, `/appearance/overrides/${key}`));
                    }
                }
            }
        }
    }

    const surfaceDetail = normalized["surfaceDetail"];
    if (surfaceDetail !== undefined) {
        if (!isObject(surfaceDetail)) {
            diagnostics.push(diag("viewer.state.malformed", "surfaceDetail must be an object.", "/surfaceDetail"));
        } else {
            if (!isBool(surfaceDetail["enabled"])) diagnostics.push(diag("viewer.state.malformed", "surfaceDetail.enabled must be a boolean.", "/surfaceDetail/enabled"));
            if (!isNumber(surfaceDetail["strength"]) || (surfaceDetail["strength"] as number) < 0 || (surfaceDetail["strength"] as number) > 1) {
                diagnostics.push(diag("viewer.state.malformed", "surfaceDetail.strength must be a finite number in [0, 1].", "/surfaceDetail/strength"));
            }
        }
    }

    if (normalized["displayGrowth"] !== undefined && normalized["displayGrowth"] !== "idealized" && normalized["displayGrowth"] !== "terraced-fluorite") {
        diagnostics.push(diag("viewer.state.malformed", "displayGrowth must be 'idealized' or 'terraced-fluorite'.", "/displayGrowth"));
    }
    if (normalized["displayGrowthSeed"] !== undefined && (!isNumber(normalized["displayGrowthSeed"]) || !Number.isInteger(normalized["displayGrowthSeed"]) || normalized["displayGrowthSeed"]! < 0 || normalized["displayGrowthSeed"]! > 0xffff_ffff)) diagnostics.push(diag("viewer.state.malformed", "displayGrowthSeed must be an unsigned 32-bit integer.", "/displayGrowthSeed"));

    const display = normalized["display"];
    if (!isObject(display)) {
        diagnostics.push(diag("viewer.state.malformed", "display must be an object.", "/display"));
    } else {
        for (const key of ["axes", "labels", "unitCell", "bonds", "wireframe"] as const) {
            if (!isBool(display[key])) diagnostics.push(diag("viewer.state.malformed", `display.${key} must be a boolean.`, `/display/${key}`));
        }
    }

    const camera = normalized["camera"];
    if (!isObject(camera)) {
        diagnostics.push(diag("viewer.state.malformed", "camera must be an object.", "/camera"));
    } else {
        if (camera["projection"] !== "perspective" && camera["projection"] !== "orthographic") {
            diagnostics.push(diag("viewer.state.malformed", "camera.projection must be 'perspective' or 'orthographic'.", "/camera/projection"));
        }
        const pos = expectVec3(camera["position"], "/camera/position", "viewer.state.malformed");
        if (pos) diagnostics.push(...pos);
        const up = expectVec3(camera["up"], "/camera/up", "viewer.state.malformed");
        if (up) diagnostics.push(...up);
        if (camera["target"] !== undefined) {
            const target = expectVec3(camera["target"], "/camera/target", "viewer.state.malformed");
            if (target) diagnostics.push(...target);
        }
        if (camera["zoom"] !== undefined && (!isNumber(camera["zoom"]) || camera["zoom"] <= 0)) {
            diagnostics.push(diag("viewer.state.malformed", "camera.zoom must be a positive finite number.", "/camera/zoom"));
        }
        if (camera["frustumHeight"] !== undefined && (!isNumber(camera["frustumHeight"]) || camera["frustumHeight"] <= 0)) {
            diagnostics.push(diag("viewer.state.malformed", "camera.frustumHeight must be a positive finite number.", "/camera/frustumHeight"));
        }
        if (camera["projection"] === "orthographic" && camera["frustumHeight"] === undefined) {
            diagnostics.push(diag("viewer.state.malformed", "orthographic camera.frustumHeight is required.", "/camera/frustumHeight"));
        }
        if (camera["projection"] === "perspective" && camera["frustumHeight"] !== undefined) {
            diagnostics.push(diag("viewer.state.malformed", "perspective camera.frustumHeight must be omitted.", "/camera/frustumHeight"));
        }
        if (!isNumber(camera["near"])) diagnostics.push(diag("viewer.state.malformed", "camera.near must be a number.", "/camera/near"));
        if (!isNumber(camera["far"])) diagnostics.push(diag("viewer.state.malformed", "camera.far must be a number.", "/camera/far"));
        const rot = expectVec3(camera["groupRotation"], "/camera/groupRotation", "viewer.state.malformed");
        if (rot) diagnostics.push(...rot);
    }

    const atomic = normalized["atomic"];
    if (!isObject(atomic)) {
        diagnostics.push(diag("viewer.state.malformed", "atomic must be an object.", "/atomic"));
    } else {
        if (atomic["viewMode"] !== "morphology" && atomic["viewMode"] !== "atomic") diagnostics.push(diag("viewer.state.malformed", "atomic.viewMode must be 'morphology' or 'atomic'.", "/atomic/viewMode"));
        const rep = expectVec3(atomic["latticeRepetition"], "/atomic/latticeRepetition", "viewer.state.malformed");
        if (rep) diagnostics.push(...rep);
    }

    const structure = normalized["structure"];
    if (structure !== undefined) {
        if (!isObject(structure) || !isObject(structure["definition"])) diagnostics.push(diag("viewer.state.malformed", "structure.definition must be an object.", "/structure/definition"));
    }

    if (diagnostics.length > 0) return { ok: false, diagnostics };

    // Shape is valid; cast. Referenced data and structural compatibility are
    // resolved by the viewer before commit.
    return { ok: true, value: normalized as unknown as ViewerState };
}

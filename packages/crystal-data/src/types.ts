import type { CrystalSystem, MillerIndices, PointOperation, SpaceOperation, AtomicStructure } from "@crystal/core";

/** A traceable source reference. */
export interface Reference {
    readonly id: string;
    readonly title?: string;
    readonly authors?: readonly string[];
    readonly year?: number;
    readonly doi?: string;
    readonly url?: string;
    readonly notes?: string;
}

export type ProvenanceStatus = "reported" | "derived" | "curated" | "estimated";

/**
 * Provenance entry covering one or more related fields. See the
 * [provenance contract](../../docs/data-model.md#scientific-confidence--provenance).
 */
export interface ProvenanceEntry {
    readonly coverage: readonly string[];
    readonly referenceIds?: readonly string[];
    readonly status: ProvenanceStatus;
    readonly derivation?: string;
}

export interface MineralUnitCell {
    readonly a: number;
    readonly b: number;
    readonly c: number;
    readonly alpha: number;
    readonly beta: number;
    readonly gamma: number;
    readonly lengthUnit?: "angstrom" | "nanometre";
}

/** Crystallographic description of a mineral's ambient phase. */
export interface MineralCrystallography {
    readonly crystalSystem: CrystalSystem;
    readonly setting?: string;
    readonly pointGroup?: string;
    readonly spaceGroup?: string;
    readonly unitCell: MineralUnitCell;
    readonly pointOperations?: readonly PointOperation[];
    readonly spaceOperations?: readonly SpaceOperation[];
    readonly identityOnly?: boolean;
    /** Original length unit retained when normalization converts to Ångström. */
    readonly sourceLengthUnit?: "angstrom" | "nanometre";
}

/** A single crystallographic form with viewer-facing development control. */
export interface CrystalFormSetting {
    readonly id: string;
    readonly label?: string;
    readonly indices: MillerIndices;
    readonly development: number;
    readonly enabled?: boolean;
}

export interface PreferredView {
    readonly cameraDirection: readonly [number, number, number];
    readonly upDirection?: readonly [number, number, number];
}

/** A named habit preset: a combination of forms and development values. */
export interface HabitPreset {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly forms: readonly CrystalFormSetting[];
    readonly preferredView?: PreferredView;
    readonly references?: readonly Reference[];
}

/** A curated mineral record with crystallography, habits, and provenance. */
export interface Mineral {
    readonly id: string;
    readonly name: string;
    readonly formula: string;
    readonly crystallography: MineralCrystallography;
    readonly habits: readonly HabitPreset[];
    readonly appearance?: readonly MineralAppearance[];
    /** Reviewed, face-specific surface observations. Renderer realization is separate. */
    readonly surfaceProfiles?: readonly SurfaceProfile[];
    readonly variants?: readonly MineralVariant[];
    readonly references: readonly Reference[];
    readonly provenance: readonly ProvenanceEntry[];
    readonly dataRevision: string;
}

/** A selector for a reviewed surface observation; it never changes morphology. */
export interface SurfaceSelector {
    readonly formId?: string;
    readonly family?: MillerIndices;
    readonly orientedIndices?: MillerIndices;
}

/** The documented directional relationship for a reviewed surface observation. */
export type SurfaceDirection =
    | { readonly kind: "perpendicular-to-crystal-axis"; readonly axis: "a" | "b" | "c" }
    | { readonly kind: "intersection-edge"; readonly otherFamily: MillerIndices };

/**
 * A traceable, typical (not specimen-measured) surface observation eligible for
 * a renderer profile. Frequencies and amplitudes deliberately do not belong here.
 */
export interface SurfaceProfile {
    readonly id: string;
    readonly kind: "directional-striations" | "pearly-luster";
    readonly claimId: string;
    readonly surfaceOrigin: "growth-face";
    readonly selector: SurfaceSelector;
    readonly direction?: SurfaceDirection;
    readonly description: string;
}

/**
 * Categorical luster classification for mineral appearance. The vocabulary is
 * documented in [Mineral Appearance](../../docs/data-model.md#mineral-appearance);
 * the numeric renderer mapping is a curated choice owned by `crystal-three`.
 */
export type LusterCategory = "vitreous" | "pearly" | "metallic" | "dull";

/** All luster categories in canonical order. */
export const LUSTER_CATEGORIES: readonly LusterCategory[] = ["vitreous", "pearly", "metallic", "dull"];

/** A named appearance preset: curated visual material parameters separate from geometry. */
export interface MineralAppearance {
    readonly id: string;
    readonly name: string;
    readonly luster?: LusterCategory;
    readonly baseColor?: string;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly transmission?: number;
    readonly ior?: number;
    readonly absorptionColor?: string;
    readonly absorptionDensity?: number;
}

/** A structural variant of the mineral (e.g. left/right-handed quartz). */
export interface MineralVariant {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    /** Crystallographic identity distinguishing this variant. */
    readonly crystallography: MineralCrystallography;
    readonly references?: readonly Reference[];
}

/** Preserved source metadata for an imported structural definition. */
export interface ImportSource {
    readonly blockId?: string;
    readonly cifRevision?: string;
    readonly temperature?: number;
    readonly lengthUnit?: "angstrom" | "nanometre";
    readonly format: "cif-1.1";
}

/**
 * A structural definition imported from CIF: cell, symmetry, sites, provenance, and
 * preserved source metadata. Converted to core inputs for atomic expansion.
 */
export interface StructuralDefinition {
    readonly id: string;
    readonly name: string;
    readonly crystallography: MineralCrystallography;
    readonly atomicStructure: AtomicStructure;
    /** Observed external crystal faces from the CIF crystal-face loop, when present. */
    readonly crystalFaces?: readonly CifCrystalFace[];
    readonly references: readonly Reference[];
    readonly provenance: readonly ProvenanceEntry[];
    readonly source: ImportSource;
    readonly authors?: readonly string[];
    readonly publicationTitle?: string;
    readonly mineralName?: string;
    readonly formula?: string;
}

/** A measured crystal face reported by the CIF experimental crystal-face category. */
export interface CifCrystalFace {
    readonly indices: { readonly h: number; readonly k: number; readonly l: number };
    readonly perpendicularDistance: number;
    readonly name?: string;
    readonly description?: string;
}

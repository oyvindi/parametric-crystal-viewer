import type { CrystalSystem, MillerIndices, PointOperation, SpaceOperation } from "@crystal/core";

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
    readonly description?: string;
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
    readonly variants?: readonly MineralVariant[];
    readonly references?: readonly Reference[];
    readonly provenance?: readonly ProvenanceEntry[];
    readonly dataRevision?: string;
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

import { MeshPhysicalMaterial, type Side, DoubleSide } from "three";

/**
 * Categorical luster vocabulary for mineral appearance. The classification is
 * documented in [Mineral Appearance](../../docs/data-model.md#mineral-appearance);
 * the numeric mapping here is a curated renderer choice, not a measurement.
 */
export type LusterCategory = "vitreous" | "pearly" | "metallic" | "dull";

/** All luster categories in canonical order. */
export const LUSTER_CATEGORIES = ["vitreous", "pearly", "metallic", "dull"] as const;

/** Fallback category when luster is absent; preserves V1 behavior. */
export const DEFAULT_LUSTER: LusterCategory = "vitreous";

/**
 * Curated renderer parameters per luster category. Every value is a curated
 * visualization choice, not a measured optical constant. The primary renderer
 * contribution is sheen for pearly surfaces; other categories keep sheen off
 * and rely on the V1 PBR fields. See the
 * [luster sheen decision](../../docs/decisions/0005-categorical-luster-pearly-sheen.md).
 */
export interface LusterProfile {
    readonly sheen: number;
    readonly sheenColor: string;
    readonly sheenRoughness: number;
}

export const LUSTER_PROFILES: Readonly<Record<LusterCategory, LusterProfile>> = {
    vitreous: { sheen: 0, sheenColor: "#ffffff", sheenRoughness: 1 },
    pearly: { sheen: 0.6, sheenColor: "#f5f5f0", sheenRoughness: 0.35 },
    metallic: { sheen: 0, sheenColor: "#ffffff", sheenRoughness: 1 },
    dull: { sheen: 0, sheenColor: "#ffffff", sheenRoughness: 1 },
};

/**
 * Renderer-neutral appearance parameters for V1 mineral materials. These map
 * to Three.js `MeshPhysicalMaterial` properties. `opacity` is deferred beyond
 * V1 (see [Mineral Appearance](../../docs/data-model.md#mineral-appearance)).
 * `luster` selects a categorical profile whose sheen parameters are applied
 * alongside the V1 fields; explicit numeric fields always take precedence.
 */
export interface AppearanceParams {
    readonly baseColor?: string;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly transmission?: number;
    readonly ior?: number;
    readonly absorptionColor?: string;
    readonly absorptionDensity?: number;
    readonly luster?: LusterCategory;
}

/** Field names supported in V1, in canonical order. `luster` is excluded: it
 * selects a categorical profile, not a user-overridable numeric field. */
export const APPEARANCE_FIELDS = [
    "baseColor",
    "roughness",
    "metalness",
    "transmission",
    "ior",
    "absorptionColor",
    "absorptionDensity",
] as const;

export type AppearanceField = (typeof APPEARANCE_FIELDS)[number];

/**
 * Fully resolved appearance: V1 defaults plus the luster category and the
 * sheen parameters derived from it. Every field is concrete; absent inputs
 * resolve to the documented defaults.
 */
export interface ResolvedAppearance {
    readonly baseColor: string;
    readonly roughness: number;
    readonly metalness: number;
    readonly transmission: number;
    readonly ior: number;
    readonly absorptionColor: string;
    readonly absorptionDensity: number;
    readonly luster: LusterCategory;
    readonly sheen: number;
    readonly sheenColor: string;
    readonly sheenRoughness: number;
}

/** Default appearance values used when a field is absent. */
export const DEFAULT_APPEARANCE: Readonly<ResolvedAppearance> = {
    baseColor: "#6fb7d4",
    roughness: 0.3,
    metalness: 0.1,
    transmission: 0,
    ior: 1.5,
    absorptionColor: "#ffffff",
    absorptionDensity: 0,
    luster: "vitreous",
    sheen: 0,
    sheenColor: "#ffffff",
    sheenRoughness: 1,
};

/**
 * Maps an absorption density (a normalized, non-negative coefficient where 0 is
 * no absorption) to a Three.js `attenuationDistance`. Three.js models volumetric
 * absorption as the distance over which light is attenuated; a higher density
 * yields a shorter distance. A density of 0 disables absorption (Infinity).
 */
export function absorptionDistance(density: number): number {
    return density > 0 ? 1 / density : Infinity;
}

/**
 * Resolves a luster category from a string, falling back to the default when
 * absent or not in the controlled vocabulary.
 */
export function resolveLuster(luster?: string): LusterCategory {
    return luster && (LUSTER_CATEGORIES as readonly string[]).includes(luster)
        ? (luster as LusterCategory)
        : DEFAULT_LUSTER;
}

/** Resolves a partial params set against the V1 defaults and the luster profile. */
export function resolveAppearance(params?: AppearanceParams): ResolvedAppearance {
    const luster = resolveLuster(params?.luster);
    const profile = LUSTER_PROFILES[luster];
    const { luster: _luster, ...rest } = params ?? {};
    return {
        ...DEFAULT_APPEARANCE,
        ...rest,
        luster,
        ...profile,
    };
}

/**
 * Applies appearance parameters to an existing `MeshPhysicalMaterial` in place.
 * Geometry is never touched. Toggling transmission sets `transparent` so the
 * renderer sorts transmissive surfaces correctly.
 */
export function applyAppearance(material: MeshPhysicalMaterial, params?: AppearanceParams): void {
    const a = resolveAppearance(params);
    material.color.set(a.baseColor);
    material.roughness = a.roughness;
    material.metalness = a.metalness;
    material.transmission = a.transmission;
    material.ior = a.ior;
    material.attenuationColor.set(a.absorptionColor);
    material.attenuationDistance = absorptionDistance(a.absorptionDensity);
    material.transparent = a.transmission > 0;
    material.sheen = a.sheen;
    material.sheenColor.set(a.sheenColor);
    material.sheenRoughness = a.sheenRoughness;
    material.envMapIntensity = 1.3;
    material.needsUpdate = true;
}

/**
 * Creates a `MeshPhysicalMaterial` from V1 appearance parameters. The viewer
 * owns rendering options (side, flatShading, wireframe); appearance owns the
 * PBR fields. `thickness` is left for the caller to set from geometry bounds so
 * volumetric absorption scales with the displayed crystal.
 */
export function createCrystalMaterial(
    params?: AppearanceParams,
    options: { side?: Side; flatShading?: boolean; wireframe?: boolean } = {},
): MeshPhysicalMaterial {
    const material = new MeshPhysicalMaterial({
        side: options.side ?? DoubleSide,
        flatShading: options.flatShading ?? true,
        wireframe: options.wireframe ?? false,
    });
    applyAppearance(material, params);
    return material;
}

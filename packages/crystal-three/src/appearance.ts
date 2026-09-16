import { MeshPhysicalMaterial, type Side, DoubleSide } from "three";

/**
 * Renderer-neutral appearance parameters for V1 mineral materials. These map
 * to Three.js `MeshPhysicalMaterial` properties. `opacity` is deferred beyond
 * V1 (see [Mineral Appearance](../../docs/data-model.md#mineral-appearance)).
 */
export interface AppearanceParams {
    readonly baseColor?: string;
    readonly roughness?: number;
    readonly metalness?: number;
    readonly transmission?: number;
    readonly ior?: number;
    readonly absorptionColor?: string;
    readonly absorptionDensity?: number;
}

/** Field names supported in V1, in canonical order. */
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

/** Default appearance values used when a field is absent. */
export const DEFAULT_APPEARANCE: Readonly<Required<AppearanceParams>> = {
    baseColor: "#6fb7d4",
    roughness: 0.3,
    metalness: 0.1,
    transmission: 0,
    ior: 1.5,
    absorptionColor: "#ffffff",
    absorptionDensity: 0,
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

/** Resolves a partial params set against the V1 defaults. */
export function resolveAppearance(params?: AppearanceParams): Required<AppearanceParams> {
    return { ...DEFAULT_APPEARANCE, ...(params ?? {}) };
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

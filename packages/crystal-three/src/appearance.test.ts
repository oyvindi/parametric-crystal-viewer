import { describe, expect, it } from "vitest";
import { DoubleSide } from "three";
import {
    createCrystalMaterial,
    applyAppearance,
    resolveAppearance,
    absorptionDistance,
    DEFAULT_APPEARANCE,
    APPEARANCE_FIELDS,
    type AppearanceParams,
} from "./appearance.js";

const params: AppearanceParams = {
    baseColor: "#8a5cd4",
    roughness: 0.08,
    metalness: 0,
    transmission: 0.8,
    ior: 1.434,
    absorptionColor: "#6a3cb4",
    absorptionDensity: 0.5,
};

describe("appearance parameter mapping", () => {
    it("maps every V1 field to the corresponding MeshPhysicalMaterial property", () => {
        const material = createCrystalMaterial(params, { flatShading: true, wireframe: false });
        expect(material.color.getHexString()).toBe("8a5cd4");
        expect(material.roughness).toBe(0.08);
        expect(material.metalness).toBe(0);
        expect(material.transmission).toBe(0.8);
        expect(material.ior).toBe(1.434);
        expect(material.attenuationColor.getHexString()).toBe("6a3cb4");
        expect(material.attenuationDistance).toBeCloseTo(2); // 1 / 0.5
        expect(material.transparent).toBe(true); // transmission > 0
        expect(material.side).toBe(DoubleSide);
        expect(material.flatShading).toBe(true);
    });

    it("maps a metallic (non-transmissive) appearance", () => {
        const material = createCrystalMaterial({ baseColor: "#c8a848", metalness: 1, roughness: 0.25, transmission: 0 });
        expect(material.metalness).toBe(1);
        expect(material.transmission).toBe(0);
        expect(material.transparent).toBe(false);
        expect(material.attenuationDistance).toBe(Infinity); // density 0 → no absorption
    });

    it("applies appearance in place without recreating the material", () => {
        const material = createCrystalMaterial();
        applyAppearance(material, params);
        expect(material.color.getHexString()).toBe("8a5cd4");
        expect(material.transmission).toBe(0.8);
        applyAppearance(material, { transmission: 0 });
        expect(material.transmission).toBe(0);
        expect(material.transparent).toBe(false);
    });

    it("maps absorptionDensity to attenuationDistance as 1/density, Infinity at 0", () => {
        expect(absorptionDistance(0)).toBe(Infinity);
        expect(absorptionDistance(1)).toBe(1);
        expect(absorptionDistance(4)).toBeCloseTo(0.25);
    });

    it("resolves omitted fields against documented V1 defaults", () => {
        const a = resolveAppearance();
        expect(a).toEqual(DEFAULT_APPEARANCE);
        const partial = resolveAppearance({ baseColor: "#ff0000" });
        expect(partial.baseColor).toBe("#ff0000");
        expect(partial.ior).toBe(DEFAULT_APPEARANCE.ior);
    });

    it("exposes the seven V1 fields in canonical order and omits opacity", () => {
        expect([...APPEARANCE_FIELDS]).toEqual([
            "baseColor", "roughness", "metalness", "transmission", "ior", "absorptionColor", "absorptionDensity",
        ]);
        expect(APPEARANCE_FIELDS).not.toContain("opacity");
    });
});

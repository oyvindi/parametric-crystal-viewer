import { describe, expect, it } from "vitest";
import { MeshPhysicalMaterial } from "three";
import {
    absorptionAttenuationDistance,
    characteristicThickness,
    isTransmissiveAppearance,
    applyTransmissionOptics,
    resolveAppearance,
    type OpticalBounds,
} from "./appearance.js";

const bounds = (min: number[], max: number[]): OpticalBounds =>
    [[min[0]!, min[1]!, min[2]!], [max[0]!, max[1]!, max[2]!]] as OpticalBounds;

describe("SR6 scale-invariant attenuation distance", () => {
    it("disables absorption for non-positive density or thickness", () => {
        expect(absorptionAttenuationDistance(0, 10)).toBe(Infinity);
        expect(absorptionAttenuationDistance(0.5, 0)).toBe(Infinity);
        expect(absorptionAttenuationDistance(-1, 10)).toBe(Infinity);
        expect(absorptionAttenuationDistance(0.5, -3)).toBe(Infinity);
        expect(absorptionAttenuationDistance(NaN, 10)).toBe(Infinity);
        expect(absorptionAttenuationDistance(0.5, Infinity)).toBe(Infinity);
    });

    it("returns thickness / density so the Beer-Lambert exponent equals density", () => {
        expect(absorptionAttenuationDistance(1, 10)).toBe(10);
        expect(absorptionAttenuationDistance(0.5, 10)).toBe(20);
        expect(absorptionAttenuationDistance(4, 2)).toBeCloseTo(0.5);
    });

    it("keeps the path/distance ratio equal to density across model scales", () => {
        for (const density of [0.25, 0.5, 1, 2, 4]) {
            for (const thickness of [1, 10, 100, 1000]) {
                const distance = absorptionAttenuationDistance(density, thickness);
                expect(thickness / distance).toBeCloseTo(density);
            }
        }
    });
});

describe("SR6 characteristic thickness estimate", () => {
    it("uses the largest bounding-box extent", () => {
        expect(characteristicThickness(bounds([0, 0, 0], [3, 5, 2]))).toBe(5);
        expect(characteristicThickness(bounds([-2, -2, -2], [2, 2, 2]))).toBe(4);
        expect(characteristicThickness(bounds([1, 1, 1], [1, 1, 1]))).toBe(0);
    });
});

describe("SR6 transmissive routing", () => {
    it("treats opaque and fully metallic appearances as non-transmissive", () => {
        expect(isTransmissiveAppearance(resolveAppearance({ transmission: 0 }))).toBe(false);
        expect(isTransmissiveAppearance(resolveAppearance({ transmission: 0.8, metalness: 1 }))).toBe(false);
        expect(isTransmissiveAppearance(resolveAppearance({ transmission: 0.8, metalness: 0 }))).toBe(true);
        expect(isTransmissiveAppearance(resolveAppearance({ transmission: 0.8, metalness: 0.5 }))).toBe(true);
    });

    it("sets scale-invariant thickness and attenuation for transmissive surfaces", () => {
        const material = new MeshPhysicalMaterial();
        const b = bounds([0, 0, 0], [4, 6, 2]);
        applyTransmissionOptics(material, resolveAppearance({ transmission: 0.8, absorptionDensity: 0.5 }), b);
        expect(material.thickness).toBe(6);
        expect(material.attenuationDistance).toBeCloseTo(12); // 6 / 0.5
        expect(material.thickness / material.attenuationDistance).toBeCloseTo(0.5);
    });

    it("keeps refraction thickness but disables absorption at density 0", () => {
        const material = new MeshPhysicalMaterial();
        applyTransmissionOptics(material, resolveAppearance({ transmission: 0.9, absorptionDensity: 0 }), bounds([0, 0, 0], [5, 5, 5]));
        expect(material.thickness).toBe(5);
        expect(material.attenuationDistance).toBe(Infinity);
    });

    it("bypasses transmission work for opaque and metallic surfaces", () => {
        const opaque = new MeshPhysicalMaterial();
        applyTransmissionOptics(opaque, resolveAppearance({ transmission: 0, metalness: 0 }), bounds([0, 0, 0], [5, 5, 5]));
        expect(opaque.thickness).toBe(0);
        expect(opaque.attenuationDistance).toBe(Infinity);
        expect(opaque.transmission).toBe(0);
        expect(opaque.transparent).toBe(false);

        const metallic = new MeshPhysicalMaterial();
        applyTransmissionOptics(metallic, resolveAppearance({ transmission: 0.8, metalness: 1 }), bounds([0, 0, 0], [5, 5, 5]));
        expect(metallic.thickness).toBe(0);
        expect(metallic.attenuationDistance).toBe(Infinity);
        // A fully metallic surface zeroes transmission so Three.js never compiles
        // the transmission chunk, even when the preset reports transmission > 0.
        expect(metallic.transmission).toBe(0);
        expect(metallic.transparent).toBe(false);
    });

    it("preserves the absorption exponent when the model is uniformly scaled", () => {
        const density = 0.6;
        const small = bounds([0, 0, 0], [3, 4, 2]);
        const large = bounds([0, 0, 0], [30, 40, 20]);
        const mSmall = new MeshPhysicalMaterial();
        const mLarge = new MeshPhysicalMaterial();
        applyTransmissionOptics(mSmall, resolveAppearance({ transmission: 0.8, absorptionDensity: density }), small);
        applyTransmissionOptics(mLarge, resolveAppearance({ transmission: 0.8, absorptionDensity: density }), large);
        // Larger model has larger thickness and proportionally larger attenuation distance.
        expect(mLarge.thickness).toBeGreaterThan(mSmall.thickness);
        expect(mLarge.attenuationDistance).toBeGreaterThan(mSmall.attenuationDistance);
        // The Beer-Lambert exponent (thickness / attenuationDistance) is identical.
        expect(mSmall.thickness / mSmall.attenuationDistance).toBeCloseTo(density);
        expect(mLarge.thickness / mLarge.attenuationDistance).toBeCloseTo(density);
    });
});

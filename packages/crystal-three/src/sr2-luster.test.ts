import { describe, expect, it } from "vitest";
import {
    resolveAppearance,
    resolveLuster,
    applyAppearance,
    createCrystalMaterial,
    LUSTER_PROFILES,
    LUSTER_CATEGORIES,
    DEFAULT_LUSTER,
    DEFAULT_APPEARANCE,
    APPEARANCE_FIELDS,
} from "./appearance.js";

describe("SR2 categorical luster vocabulary", () => {
    it("exposes the four controlled vocabulary categories and a documented fallback", () => {
        expect([...LUSTER_CATEGORIES]).toEqual(["vitreous", "pearly", "metallic", "dull"]);
        expect(DEFAULT_LUSTER).toBe("vitreous");
    });

    it("every category has a curated profile with sheen params", () => {
        for (const cat of LUSTER_CATEGORIES) {
            const profile = LUSTER_PROFILES[cat];
            expect(profile).toBeDefined();
            expect(typeof profile.sheen).toBe("number");
            expect(profile.sheen).toBeGreaterThanOrEqual(0);
            expect(profile.sheen).toBeLessThanOrEqual(1);
            expect(typeof profile.sheenColor).toBe("string");
            expect(typeof profile.sheenRoughness).toBe("number");
        }
    });

    it("only pearly enables sheen; other categories keep sheen at zero", () => {
        expect(LUSTER_PROFILES.pearly.sheen).toBeGreaterThan(0);
        for (const cat of ["vitreous", "metallic", "dull"] as const) {
            expect(LUSTER_PROFILES[cat].sheen).toBe(0);
        }
    });

    it("luster is not a user-overridable field", () => {
        expect(APPEARANCE_FIELDS).not.toContain("luster");
    });
});

describe("SR2 resolveLuster", () => {
    it("resolves valid categories", () => {
        for (const cat of LUSTER_CATEGORIES) {
            expect(resolveLuster(cat)).toBe(cat);
        }
    });

    it("falls back to vitreous when absent", () => {
        expect(resolveLuster(undefined)).toBe("vitreous");
    });

    it("falls back to vitreous for unknown values", () => {
        expect(resolveLuster("greasy")).toBe("vitreous");
        expect(resolveLuster("")).toBe("vitreous");
    });
});

describe("SR2 resolveAppearance with luster", () => {
    it("resolves luster to vitreous and sheen to 0 when luster is absent", () => {
        const a = resolveAppearance({ baseColor: "#ff0000" });
        expect(a.luster).toBe("vitreous");
        expect(a.sheen).toBe(0);
        expect(a.sheenColor).toBe("#ffffff");
        expect(a.sheenRoughness).toBe(1);
        // V1 fields are unchanged from the previous default behavior.
        expect(a.baseColor).toBe("#ff0000");
        expect(a.roughness).toBe(DEFAULT_APPEARANCE.roughness);
        expect(a.metalness).toBe(DEFAULT_APPEARANCE.metalness);
    });

    it("resolves pearly luster to the pearly sheen profile", () => {
        const a = resolveAppearance({ luster: "pearly" });
        expect(a.luster).toBe("pearly");
        expect(a.sheen).toBe(LUSTER_PROFILES.pearly.sheen);
        expect(a.sheenColor).toBe(LUSTER_PROFILES.pearly.sheenColor);
        expect(a.sheenRoughness).toBe(LUSTER_PROFILES.pearly.sheenRoughness);
    });

    it("explicit numeric fields take precedence over luster category defaults", () => {
        const a = resolveAppearance({ luster: "pearly", roughness: 0.9, metalness: 0.5 });
        expect(a.roughness).toBe(0.9);
        expect(a.metalness).toBe(0.5);
        // Sheen still comes from the pearly profile.
        expect(a.sheen).toBe(LUSTER_PROFILES.pearly.sheen);
    });

    it("resolves metallic luster with sheen off", () => {
        const a = resolveAppearance({ luster: "metallic", metalness: 0.85 });
        expect(a.luster).toBe("metallic");
        expect(a.metalness).toBe(0.85);
        expect(a.sheen).toBe(0);
    });

    it("resolves dull luster with sheen off", () => {
        const a = resolveAppearance({ luster: "dull", roughness: 0.8 });
        expect(a.luster).toBe("dull");
        expect(a.sheen).toBe(0);
    });

    it("backward-compatible: no luster produces the same V1 values as before", () => {
        const a = resolveAppearance();
        expect(a.baseColor).toBe(DEFAULT_APPEARANCE.baseColor);
        expect(a.roughness).toBe(DEFAULT_APPEARANCE.roughness);
        expect(a.metalness).toBe(DEFAULT_APPEARANCE.metalness);
        expect(a.transmission).toBe(DEFAULT_APPEARANCE.transmission);
        expect(a.ior).toBe(DEFAULT_APPEARANCE.ior);
        expect(a.absorptionColor).toBe(DEFAULT_APPEARANCE.absorptionColor);
        expect(a.absorptionDensity).toBe(DEFAULT_APPEARANCE.absorptionDensity);
        expect(a.sheen).toBe(0);
    });
});

describe("SR2 applyAppearance sheen mapping", () => {
    it("applies pearly sheen to the material", () => {
        const material = createCrystalMaterial({ luster: "pearly" });
        expect(material.sheen).toBe(LUSTER_PROFILES.pearly.sheen);
        expect(material.sheenColor.getHexString()).toBe(LUSTER_PROFILES.pearly.sheenColor.replace("#", ""));
        expect(material.sheenRoughness).toBe(LUSTER_PROFILES.pearly.sheenRoughness);
    });

    it("keeps sheen at zero for vitreous", () => {
        const material = createCrystalMaterial({ luster: "vitreous" });
        expect(material.sheen).toBe(0);
    });

    it("keeps sheen at zero when luster is absent (backward compatible)", () => {
        const material = createCrystalMaterial();
        expect(material.sheen).toBe(0);
    });

    it("updates sheen in place when switching luster", () => {
        const material = createCrystalMaterial({ luster: "pearly" });
        expect(material.sheen).toBeGreaterThan(0);
        applyAppearance(material, { luster: "vitreous" });
        expect(material.sheen).toBe(0);
    });

    it("keeps sheen off for metallic", () => {
        const material = createCrystalMaterial({ luster: "metallic", metalness: 0.85 });
        expect(material.sheen).toBe(0);
        expect(material.metalness).toBe(0.85);
    });
});

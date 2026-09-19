import { describe, expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import {
    createCrystalInput,
    loadMineral,
    validateMineral,
    LUSTER_CATEGORIES,
    FLUORITE,
    QUARTZ,
    PYRITE,
    ALBITE,
    GYPSUM,
    FORSTERITE,
    BERYL,
    CALCITE,
    ANATASE,
    type LusterCategory,
} from "./index.js";

const codes = (value: unknown) => validateMineral(value).diagnostics.map((d) => d.code);

const MINERALS_WITH_APPEARANCE: readonly { mineral: typeof FLUORITE; expected: Record<string, LusterCategory> }[] = [
    { mineral: FLUORITE,   expected: { violet: "vitreous", green: "vitreous", colorless: "vitreous" } },
    { mineral: QUARTZ,     expected: { "rock-crystal": "vitreous", amethyst: "vitreous", smoky: "vitreous", citrine: "vitreous", rose: "vitreous" } },
    { mineral: PYRITE,     expected: { brass: "metallic", tarnished: "metallic" } },
    { mineral: ALBITE,    expected: { white: "vitreous" } },
    { mineral: FORSTERITE, expected: { olive: "vitreous", colorless: "vitreous" } },
    { mineral: BERYL,     expected: { emerald: "vitreous", aquamarine: "vitreous", goshenite: "vitreous" } },
    { mineral: GYPSUM,    expected: { colorless: "vitreous", selenite: "vitreous" } },
    { mineral: CALCITE,   expected: { colorless: "vitreous", yellow: "vitreous" } },
    { mineral: ANATASE,   expected: { indigo: "metallic", golden: "metallic" } },
];

describe("SR2 luster vocabulary and records", () => {
    it("exports the four controlled vocabulary categories", () => {
        expect([...LUSTER_CATEGORIES]).toEqual(["vitreous", "pearly", "metallic", "dull"]);
    });

    it.each(MINERALS_WITH_APPEARANCE)("every $mineral.id appearance preset has a valid luster", ({ mineral, expected }) => {
        const loaded = loadMineral(mineral.id);
        expect(loaded.appearance).toBeDefined();
        for (const preset of loaded.appearance!) {
            expect(preset.luster).toBeDefined();
            expect(LUSTER_CATEGORIES).toContain(preset.luster);
            expect(preset.luster).toBe(expected[preset.id]);
        }
    });

    it("does not transfer gypsum's pearly cleavage luster to whole-crystal presets", () => {
        const loaded = loadMineral("gypsum");
        expect(loaded.appearance!.every((preset) => preset.luster === "vitreous")).toBe(true);
    });

    it("pyrite presets are metallic", () => {
        const loaded = loadMineral("pyrite");
        for (const preset of loaded.appearance!) {
            expect(preset.luster).toBe("metallic");
        }
    });

    it("catalog luster classifications have reported source provenance", () => {
        for (const { mineral } of MINERALS_WITH_APPEARANCE) {
            const loaded = loadMineral(mineral.id);
            const lusterProvenance = loaded.provenance.find((entry) =>
                entry.coverage.includes("appearance.*.luster"));
            expect(lusterProvenance?.status).toBe("reported");
            expect(lusterProvenance?.referenceIds?.length).toBeGreaterThan(0);
        }
    });

    it("calcite and anatase appearance presets validate and load", () => {
        for (const source of [CALCITE, ANATASE] as const) {
            expect(loadMineral(source.id).appearance).toBeDefined();
            expect(validateMineral(source).ok).toBe(true);
        }
    });
});

describe("SR2 luster validation", () => {
    it("rejects an unknown luster category", () => {
        const source = structuredClone(QUARTZ) as any;
        source.appearance[0].luster = "greasy";
        expect(validateMineral(source).ok).toBe(false);
        expect(codes(source)).toContain("data.record.invalid-field");
    });

    it("accepts a valid luster category", () => {
        const source = structuredClone(QUARTZ) as any;
        source.appearance[0].luster = "vitreous";
        expect(validateMineral(source).ok).toBe(true);
    });

    it("accepts the absence of luster (backward compatible)", () => {
        const source = structuredClone(QUARTZ) as any;
        delete source.appearance[0].luster;
        expect(validateMineral(source).ok).toBe(true);
    });

    it("requires provenance coverage for luster", () => {
        const source = structuredClone(QUARTZ) as any;
        source.provenance = source.provenance.filter((e: { coverage: readonly string[] }) => !e.coverage.includes("appearance"));
        expect(validateMineral(source).ok).toBe(false);
        expect(codes(source)).toContain("data.record.invalid-provenance");
    });

    it("luster does not modify scientific geometry", () => {
        for (const { mineral } of MINERALS_WITH_APPEARANCE) {
            const withAppearance = createCrystalInput(loadMineral(mineral.id));
            const stripped = structuredClone(mineral) as any;
            delete stripped.appearance;
            stripped.provenance = stripped.provenance.filter((e: { coverage: readonly string[] }) =>
                !e.coverage.some((coverage) => coverage === "appearance" || coverage.startsWith("appearance.")));
            const withoutAppearance = createCrystalInput(loadMineral(stripped));
            expect(generateCrystal(withAppearance.crystallography, withAppearance.morphology))
                .toEqual(generateCrystal(withoutAppearance.crystallography, withoutAppearance.morphology));
        }
    });
});

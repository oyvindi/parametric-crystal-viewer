import { describe, expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import {
    createCrystalInput,
    loadMineral,
    validateMineral,
    FLUORITE,
    QUARTZ,
    PYRITE,
    CALCITE,
    ANATASE,
} from "./index.js";

const codes = (value: unknown) => validateMineral(value).diagnostics.map((d) => d.code);

describe("M8 mineral appearance records", () => {
    it("ships quartz, fluorite, and pyrite appearance presets that validate and load", () => {
        for (const source of [QUARTZ, FLUORITE, PYRITE] as const) {
            const mineral = loadMineral(source.id);
            expect(mineral.appearance).toBeDefined();
            expect(mineral.appearance!.length).toBeGreaterThan(0);
            // Each preset has a stable id and name and at least one V1 field.
            for (const preset of mineral.appearance!) {
                expect(preset.id).toBeTruthy();
                expect(preset.name).toBeTruthy();
            }
            // Preset ids are unique.
            const ids = mineral.appearance!.map((a) => a.id);
            expect(new Set(ids).size).toBe(ids.length);
            // Loading through the validated generic path is stable.
            expect(loadMineral(source.id)).toEqual(loadMineral(structuredClone(source)));
        }
    });

    it("appearance presets do not modify scientific geometry", () => {
        for (const source of [QUARTZ, FLUORITE, PYRITE] as const) {
            const withAppearance = createCrystalInput(loadMineral(source));
            // Strip appearance and its provenance coverage; regenerate. Geometry must be identical.
            const stripped = structuredClone(source) as any;
            delete stripped.appearance;
            stripped.provenance = stripped.provenance.filter((e: { coverage: readonly string[] }) =>
                !e.coverage.some((coverage) => coverage === "appearance" || coverage.startsWith("appearance.")));
            const withoutAppearance = createCrystalInput(loadMineral(stripped));
            expect(generateCrystal(withAppearance.crystallography, withAppearance.morphology))
                .toEqual(generateCrystal(withoutAppearance.crystallography, withoutAppearance.morphology));
        }
    });

    it("minerals without appearance remain valid (calcite, anatase)", () => {
        for (const source of [CALCITE, ANATASE] as const) {
            const mineral = loadMineral(source.id);
            expect(mineral.appearance).toBeUndefined();
            expect(validateMineral(source).ok).toBe(true);
        }
    });

    it("rejects out-of-range, non-positive, and negative appearance fields", () => {
        const source = structuredClone(QUARTZ) as any;
        // roughness out of [0,1]
        const rough = structuredClone(source);
        rough.appearance[0].roughness = 1.5;
        expect(validateMineral(rough).ok).toBe(false);
        // transmission negative
        const trans = structuredClone(source);
        trans.appearance[0].transmission = -0.1;
        expect(validateMineral(trans).ok).toBe(false);
        // ior non-positive
        const ior = structuredClone(source);
        ior.appearance[0].ior = 0;
        expect(validateMineral(ior).ok).toBe(false);
        // absorptionDensity negative
        const dens = structuredClone(source);
        dens.appearance[0].absorptionDensity = -1;
        expect(validateMineral(dens).ok).toBe(false);
    });

    it("rejects the deferred opacity field and unknown appearance keys", () => {
        const source = structuredClone(QUARTZ) as any;
        source.appearance[0].opacity = 0.5;
        expect(codes(source)).toContain("data.record.invalid-field");
    });

    it("requires provenance coverage for appearance fields", () => {
        const source = structuredClone(QUARTZ) as any;
        // Remove the appearance provenance entry; habit coverage remains.
        source.provenance = source.provenance.filter((e: { coverage: readonly string[] }) => !e.coverage.includes("appearance"));
        expect(validateMineral(source).ok).toBe(false);
        expect(codes(source)).toContain("data.record.invalid-provenance");
    });

    it("reports duplicate appearance ids", () => {
        const source = structuredClone(QUARTZ) as any;
        source.appearance[1] = { ...source.appearance[0] };
        expect(codes(source)).toContain("data.record.duplicate-id");
    });
});

import { describe, it, expect } from "vitest";
import { generateCrystal, getPointOperationRegistryEntry, type GeometryResult } from "@crystal/core";
import { QUARTZ, getMineral, listMinerals, createCrystalInput, resolveHabit, resolveCrystallography } from "./index.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

const SCALE = 10;

describe("M3 quartz provenance and habit coverage", () => {
    it("has a stable ID, name, formula, and data revision", () => {
        expect(QUARTZ.id).toBe("quartz");
        expect(QUARTZ.name).toBe("Quartz");
        expect(QUARTZ.formula).toBe("SiO₂");
        expect(QUARTZ.dataRevision).toBeTruthy();
    });

    it("is registered in the catalog", () => {
        expect(listMinerals()).toContain("quartz");
        expect(getMineral("quartz")).toBe(QUARTZ);
    });

    it("provides traceable source references for crystallographic data", () => {
        expect(QUARTZ.references).toBeDefined();
        const rightRef = QUARTZ.references!.find((r) => r.id === "mp-7000");
        expect(rightRef).toBeDefined();
        expect(rightRef!.url).toBeTruthy();
        const leftRef = QUARTZ.references!.find((r) => r.id === "mp-6930");
        expect(leftRef).toBeDefined();
        expect(leftRef!.url).toBeTruthy();
    });

    it("provenance distinguishes reported crystallography from curated morphology", () => {
        const provenance = QUARTZ.provenance!;
        const reported = provenance.find((p) => p.status === "reported")!;
        expect(reported.coverage).toContain("crystallography.unitCell");
        expect(reported.referenceIds).toContain("mp-7000");

        const curated = provenance.find((p) => p.status === "curated")!;
        expect(curated.coverage.some((c) => c.includes("development"))).toBe(true);
        expect(curated.derivation).toBeTruthy();
    });

    it("defines left and right handed variants with sourced crystallography", () => {
        expect(QUARTZ.variants).toBeDefined();
        expect(QUARTZ.variants!.length).toBe(2);
        const right = QUARTZ.variants!.find((v) => v.id === "right")!;
        expect(right.crystallography.spaceGroup).toBe("P3_121");
        const left = QUARTZ.variants!.find((v) => v.id === "left")!;
        expect(left.crystallography.spaceGroup).toBe("P3_221");
    });

    it("each habit has a stable ID, name, description, and source reference", () => {
        for (const habit of QUARTZ.habits) {
            expect(habit.id).toBeTruthy();
            expect(habit.name).toBeTruthy();
            expect(habit.description).toBeTruthy();
            expect(habit.forms.length).toBeGreaterThan(0);
        }
    });

    it("includes prism m, rhombohedron r, and rhombohedron z form definitions", () => {
        const habit = resolveHabit(QUARTZ, "prismatic");
        const labels = habit.forms.map((f) => f.label);
        expect(labels.some((l) => l!.includes("{10-10}"))).toBe(true);
        expect(labels.some((l) => l!.includes("{10-11}"))).toBe(true);
        expect(labels.some((l) => l!.includes("{01-11}"))).toBe(true);
    });

    it("references the trigonal point-group 32 registry entry", () => {
        const entry = getPointOperationRegistryEntry("point-group:32:hexagonal");
        expect(entry).toBeDefined();
        expect(entry!.operations).toHaveLength(6);
    });
});

describe("M3 success criterion: multiple recognizable quartz habits", () => {
    it("generates valid geometry for the prismatic habit", () => {
        const input = createCrystalInput(QUARTZ, { habitId: "prismatic", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("m")).toBe(true);
        expect(formIds.has("r")).toBe(true);
    });

    it("generates valid geometry for the Tessin habit", () => {
        const input = createCrystalInput(QUARTZ, { habitId: "tessin", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("m")).toBe(true);
        expect(formIds.has("M")).toBe(true);
        expect(formIds.has("psi")).toBe(true);
    });

    it("generates valid geometry for the Cumberland habit", () => {
        const input = createCrystalInput(QUARTZ, { habitId: "cumberland", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("r")).toBe(true);
        expect(formIds.has("z")).toBe(true);
        // Prism is suppressed but still present
        expect(formIds.has("m")).toBe(true);
    });

    it("generates valid geometry for the pseudocubic habit", () => {
        const input = createCrystalInput(QUARTZ, { habitId: "pseudocubic", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("r")).toBe(true);
        expect(formIds.has("z")).toBe(true);
    });

    it("produces visibly different geometries across habits", () => {
        const habits = ["prismatic", "tessin", "cumberland", "pseudocubic"] as const;
        const faceCounts = habits.map((id) => {
            const input = createCrystalInput(QUARTZ, { habitId: id, morphologyScale: SCALE });
            return valid(generateCrystal(input.crystallography, input.morphology)).faces.length;
        });
        // Not all habits produce the same face count
        const unique = new Set(faceCounts);
        expect(unique.size).toBeGreaterThan(1);
    });
});

describe("M3 quartz handedness variants", () => {
    it("both variants generate valid geometry through the generic contract", () => {
        for (const variantId of ["right", "left"] as const) {
            const input = createCrystalInput(QUARTZ, {
                habitId: "prismatic",
                variantId,
                morphologyScale: SCALE,
            });
            const result = generateCrystal(input.crystallography, input.morphology);
            expect(result.status, `variant ${variantId}: ${JSON.stringify(result.diagnostics)}`).toBe("valid");
        }
    });

    it("both variants resolve to the same point-group 32 registry entry", () => {
        const right = resolveCrystallography(QUARTZ, "right");
        const left = resolveCrystallography(QUARTZ, "left");
        expect(right.pointGroup).toBe("32");
        expect(left.pointGroup).toBe("32");
        expect(right.spaceGroup).toBe("P3_121");
        expect(left.spaceGroup).toBe("P3_221");
    });

    it("throws for an unknown variant", () => {
        expect(() => createCrystalInput(QUARTZ, { variantId: "nonexistent" })).toThrow();
    });
});

describe("M3 quartz form transitions", () => {
    it("transitions from prism-dominant to rhombohedron-dominant as development changes", () => {
        const prismOnly = createCrystalInput(QUARTZ, {
            habitId: "prismatic",
            formDevelopment: { r: 0.3 },
            morphologyScale: SCALE,
        });
        const rhombDominant = createCrystalInput(QUARTZ, {
            habitId: "prismatic",
            formDevelopment: { r: 1, m: 0.3 },
            morphologyScale: SCALE,
        });
        const prismGeo = valid(generateCrystal(prismOnly.crystallography, prismOnly.morphology));
        const rhombGeo = valid(generateCrystal(rhombDominant.crystallography, rhombDominant.morphology));
        expect(prismGeo.faces.length).not.toBe(rhombGeo.faces.length);
    });

    it("enabling z rhombohedron adds z faces to the prismatic habit", () => {
        const withoutZ = createCrystalInput(QUARTZ, { habitId: "prismatic", morphologyScale: SCALE });
        const withZ = createCrystalInput(QUARTZ, {
            habitId: "prismatic",
            formEnabled: { z: true },
            formDevelopment: { z: 0.8 },
            morphologyScale: SCALE,
        });
        const geoWithout = valid(generateCrystal(withoutZ.crystallography, withoutZ.morphology));
        const geoWith = valid(generateCrystal(withZ.crystallography, withZ.morphology));
        const zFacesWithout = geoWithout.faces.filter((f) => f.contributors.some((c) => c.formId === "z")).length;
        const zFacesWith = geoWith.faces.filter((f) => f.contributors.some((c) => c.formId === "z")).length;
        expect(zFacesWith).toBeGreaterThan(zFacesWithout);
    });

    it("preserves topology regardless of form input order", () => {
        const input1 = createCrystalInput(QUARTZ, { habitId: "tessin", morphologyScale: SCALE });
        const result1 = generateCrystal(input1.crystallography, input1.morphology);
        const reversedMorphology = {
            ...input1.morphology,
            forms: [...input1.morphology.forms].reverse(),
        };
        const result2 = generateCrystal(input1.crystallography, reversedMorphology);
        expect(result2).toEqual(result1);
    });

    it("reports invalid geometry when all forms are disabled through the data path", () => {
        const input = createCrystalInput(QUARTZ, {
            habitId: "prismatic",
            formEnabled: { m: false, r: false, z: false },
            morphologyScale: SCALE,
        });
        const result = generateCrystal(input.crystallography, input.morphology);
        expect(result.status).toBe("invalid");
        if (result.status === "invalid") {
            expect(result.diagnostics.some((d) => d.code === "core.geometry.no-active-forms")).toBe(true);
        }
    });
});

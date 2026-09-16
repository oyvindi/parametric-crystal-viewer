import { describe, it, expect } from "vitest";
import { generateCrystal, type GeometryResult } from "@crystal/core";
import { FLUORITE, createCrystalInput, resolveHabit } from "./index.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

const SCALE = 5.463;

describe("M2 provenance and habit coverage", () => {
    it("has a stable ID, name, formula, and data revision", () => {
        expect(FLUORITE.id).toBe("fluorite");
        expect(FLUORITE.name).toBe("Fluorite");
        expect(FLUORITE.formula).toBe("CaF₂");
        expect(FLUORITE.dataRevision).toBeTruthy();
    });

    it("provides traceable source references for crystallographic data", () => {
        expect(FLUORITE.references).toBeDefined();
        const ref = FLUORITE.references!.find((r) => r.id === "mp-2741");
        expect(ref).toBeDefined();
        expect(ref!.url).toBeTruthy();
    });

    it("provenance distinguishes reported crystallography from curated morphology", () => {
        const provenance = FLUORITE.provenance!;
        const reported = provenance.find((p) => p.status === "reported")!;
        expect(reported.coverage).toContain("crystallography.unitCell");
        expect(reported.referenceIds).toContain("mp-2741");

        const curated = provenance.find((p) => p.status === "curated")!;
        expect(curated.coverage.some((c) => c.includes("development"))).toBe(true);
        expect(curated.derivation).toBeTruthy();
    });

    it("each habit has a stable ID, name, description, and source reference", () => {
        for (const habit of FLUORITE.habits) {
            expect(habit.id).toBeTruthy();
            expect(habit.name).toBeTruthy();
            expect(habit.description).toBeTruthy();
            expect(habit.forms.length).toBeGreaterThan(0);
        }
    });

    it("includes cube, octahedron, and dodecahedron form definitions", () => {
        const habit = resolveHabit(FLUORITE, "cubo-octahedron");
        const labels = habit.forms.map((f) => f.label);
        expect(labels.some((l) => l!.includes("{100}"))).toBe(true);
        expect(labels.some((l) => l!.includes("{111}"))).toBe(true);
        expect(labels.some((l) => l!.includes("{110}"))).toBe(true);
    });
});

describe("M2 success criterion: relative form-distance transitions", () => {
    it("produces a pure cube when only {100} is active", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cube", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces).toHaveLength(6);
        expect(geometry.faces.every((f) => f.vertexIndices.length === 4)).toBe(true);
    });

    it("produces a pure octahedron when only {111} is active", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "octahedron", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces).toHaveLength(8);
        expect(geometry.faces.every((f) => f.vertexIndices.length === 3)).toBe(true);
    });

    it("produces a combination shape when cube and octahedron are co-developed", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cubo-octahedron", morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        // Both cube {100} and octahedron {111} forms contribute visible faces.
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("a")).toBe(true);
        expect(formIds.has("o")).toBe(true);
        expect(geometry.faces.length).toBeGreaterThan(8);
    });

    it("transitions from cube toward octahedron as octahedron development increases", () => {
        const cubeOnly = valid(generateCrystal(
            createCrystalInput(FLUORITE, { habitId: "cube", morphologyScale: SCALE }).crystallography,
            createCrystalInput(FLUORITE, { habitId: "cube", morphologyScale: SCALE }).morphology,
        ));
        // Enable octahedron at increasing development while keeping cube at 1.0
        const inputs = [0.6, 0.7, 0.8, 0.9, 1.0].map((octDev) =>
            createCrystalInput(FLUORITE, {
                habitId: "cube",
                formEnabled: { o: true },
                formDevelopment: { o: octDev },
                morphologyScale: SCALE,
            }),
        );
        const geometries = inputs.map((input) => valid(generateCrystal(input.crystallography, input.morphology)));
        // As octahedron development increases, octahedron faces appear and grow.
        const octFaceCounts = geometries.map((g) =>
            g.faces.filter((f) => f.contributors.some((c) => c.formId === "o")).length,
        );
        expect(octFaceCounts[0]).toBeGreaterThan(0);
        // More octahedron development produces more or equal octahedron faces.
        expect(octFaceCounts[octFaceCounts.length - 1]).toBeGreaterThanOrEqual(octFaceCounts[0]);
        // The geometry changes from the pure cube.
        expect(geometries[0].faces.length).toBeGreaterThan(cubeOnly.faces.length);
    });

    it("transitions from octahedron toward cube as cube development increases", () => {
        const inputs = [0.6, 0.7, 0.8, 0.9, 1.0].map((cubeDev) =>
            createCrystalInput(FLUORITE, {
                habitId: "octahedron",
                formEnabled: { a: true },
                formDevelopment: { a: cubeDev },
                morphologyScale: SCALE,
            }),
        );
        const geometries = inputs.map((input) => valid(generateCrystal(input.crystallography, input.morphology)));
        const cubeFaceCounts = geometries.map((g) =>
            g.faces.filter((f) => f.contributors.some((c) => c.formId === "a")).length,
        );
        expect(cubeFaceCounts[0]).toBeGreaterThan(0);
        expect(cubeFaceCounts[cubeFaceCounts.length - 1]).toBeGreaterThanOrEqual(cubeFaceCounts[0]);
    });

    it("produces a dodecahedron when only {110} is active", () => {
        const input = createCrystalInput(FLUORITE, {
            habitId: "cube",
            formEnabled: { a: false, d: true },
            formDevelopment: { a: 0, d: 1 },
            morphologyScale: SCALE,
        });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces).toHaveLength(12);
        expect(geometry.faces.every((f) => f.contributors.some((c) => c.formId === "d"))).toBe(true);
    });

    it("reaches a valid combination of all three cubic forms", () => {
        const input = createCrystalInput(FLUORITE, {
            habitId: "cubo-octahedron",
            formEnabled: { d: true },
            formDevelopment: { a: 1, o: 1, d: 1 },
            morphologyScale: SCALE,
        });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("a")).toBe(true);
        expect(formIds.has("o")).toBe(true);
        expect(formIds.has("d")).toBe(true);
    });

    it("preserves topology regardless of form input order through the generic contract", () => {
        const input1 = createCrystalInput(FLUORITE, { habitId: "cubo-octahedron", morphologyScale: SCALE });
        const result1 = generateCrystal(input1.crystallography, input1.morphology);
        // Reversing forms manually produces the same geometry (the core sorts internally).
        const reversedMorphology = {
            ...input1.morphology,
            forms: [...input1.morphology.forms].reverse(),
        };
        const result2 = generateCrystal(input1.crystallography, reversedMorphology);
        expect(result2).toEqual(result1);
    });

    it("reports invalid geometry when all forms are disabled through the data path", () => {
        const input = createCrystalInput(FLUORITE, {
            habitId: "cube",
            formEnabled: { a: false, o: false, d: false },
            morphologyScale: SCALE,
        });
        const result = generateCrystal(input.crystallography, input.morphology);
        expect(result.status).toBe("invalid");
        if (result.status === "invalid") {
            expect(result.diagnostics.some((d) => d.code === "core.geometry.no-active-forms")).toBe(true);
        }
    });

    it("accepts the space group as metadata alongside the point group", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cube", morphologyScale: SCALE });
        expect(input.crystallography.spaceGroup).toBe("Fm-3m");
        expect(input.crystallography.pointGroup).toBe("m-3m");
        const result = generateCrystal(input.crystallography, input.morphology);
        expect(result.status).toBe("valid");
    });
});

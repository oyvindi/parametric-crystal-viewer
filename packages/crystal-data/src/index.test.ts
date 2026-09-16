import { describe, it, expect } from "vitest";
import { generateCrystal, getPointOperationRegistryEntry, type GeometryResult } from "@crystal/core";
import { FLUORITE, getMineral, listMinerals, createCrystalInput, resolveHabit } from "./index.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

describe("fluorite record", () => {
    it("is registered in the catalog", () => {
        expect(listMinerals()).toEqual(["fluorite"]);
        expect(getMineral("fluorite")).toBe(FLUORITE);
        expect(getMineral("unknown")).toBeUndefined();
    });

    it("has cubic m-3m crystallography with a reported unit cell", () => {
        const c = FLUORITE.crystallography;
        expect(c.crystalSystem).toBe("cubic");
        expect(c.pointGroup).toBe("m-3m");
        expect(c.setting).toBe("cubic-standard");
        expect(c.spaceGroup).toBe("Fm-3m");
        expect(c.unitCell).toEqual({ a: 5.463, b: 5.463, c: 5.463, alpha: 90, beta: 90, gamma: 90 });
    });

    it("has at least two documented named habits", () => {
        expect(FLUORITE.habits.length).toBeGreaterThanOrEqual(2);
        for (const habit of FLUORITE.habits) {
            expect(habit.id).toBeTruthy();
            expect(habit.name).toBeTruthy();
            expect(habit.description).toBeTruthy();
            expect(habit.forms.length).toBeGreaterThan(0);
        }
    });

    it("records provenance with reported and curated status", () => {
        expect(FLUORITE.provenance).toBeDefined();
        const provenance = FLUORITE.provenance!;
        const statuses = provenance.map((p) => p.status);
        expect(statuses).toContain("reported");
        expect(statuses).toContain("curated");
        const reported = provenance.find((p) => p.status === "reported")!;
        expect(reported.coverage).toContain("crystallography.unitCell");
        expect(reported.referenceIds).toContain("mp-2741");
        const curated = provenance.find((p) => p.status === "curated")!;
        expect(curated.coverage.some((c) => c.includes("development"))).toBe(true);
    });

    it("references the same registry entry as M1", () => {
        const entry = getPointOperationRegistryEntry("point-group:m-3m:standard");
        expect(entry).toBeDefined();
        expect(entry!.operations).toHaveLength(48);
    });
});

describe("fluorite geometry through the generic core contract", () => {
    it("generates a valid cube from the cube habit", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cube", morphologyScale: 5.463 });
        const result = generateCrystal(input.crystallography, input.morphology);
        const geometry = valid(result);
        expect(geometry.faces).toHaveLength(6);
        expect(geometry.faces.every((f) => f.contributors[0]?.formId === "a")).toBe(true);
    });

    it("generates a valid octahedron from the octahedron habit", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "octahedron", morphologyScale: 5.463 });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces).toHaveLength(8);
        expect(geometry.faces.every((f) => f.contributors[0]?.formId === "o")).toBe(true);
    });

    it("generates a valid cubo-octahedron from the combination habit", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cubo-octahedron", morphologyScale: 5.463 });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces.length).toBeGreaterThan(8);
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("a")).toBe(true);
        expect(formIds.has("o")).toBe(true);
    });

    it("transitions from cube to octahedron as relative development changes", () => {
        const base = createCrystalInput(FLUORITE, { habitId: "cubo-octahedron", morphologyScale: 5.463 });
        // Cube dominant: cube at 1, octahedron at 0.3 (far from origin)
        const cubeDominant = createCrystalInput(FLUORITE, {
            habitId: "cubo-octahedron",
            formDevelopment: { o: 0.3 },
            morphologyScale: 5.463,
        });
        // Octahedron dominant: cube at 0.3, octahedron at 1
        const octDominant = createCrystalInput(FLUORITE, {
            habitId: "cubo-octahedron",
            formDevelopment: { a: 0.3, o: 1 },
            morphologyScale: 5.463,
        });
        const cubeGeo = valid(generateCrystal(cubeDominant.crystallography, cubeDominant.morphology));
        const octGeo = valid(generateCrystal(octDominant.crystallography, octDominant.morphology));
        const baseGeo = valid(generateCrystal(base.crystallography, base.morphology));
        // Cube-dominant has more cube faces surviving as large faces; octahedron-dominant has more octahedron faces.
        // The transition changes face count and bounds.
        expect(cubeGeo.faces.length).not.toBe(octGeo.faces.length);
        expect(baseGeo.faces.length).not.toBe(cubeGeo.faces.length);
    });

    it("applies form development overrides on top of the habit", () => {
        const input = createCrystalInput(FLUORITE, {
            habitId: "cube",
            formDevelopment: { o: 0.8 },
            formEnabled: { o: true },
            morphologyScale: 5.463,
        });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("o")).toBe(true);
    });

    it("defaults to the first habit when no habit is specified", () => {
        const input = createCrystalInput(FLUORITE, { morphologyScale: 5.463 });
        expect(resolveHabit(FLUORITE, input.morphology.forms.length > 0 ? undefined : undefined).id).toBe("cube");
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces).toHaveLength(6);
    });

    it("throws for an unknown habit", () => {
        expect(() => createCrystalInput(FLUORITE, { habitId: "nonexistent" })).toThrow();
    });

    it("rejects invalid development overrides before geometry", () => {
        const input = createCrystalInput(FLUORITE, { habitId: "cube", formDevelopment: { a: -0.5 } });
        const result = generateCrystal(input.crystallography, input.morphology);
        expect(result.status).toBe("invalid");
        if (result.status === "invalid") {
            expect(result.diagnostics.some((d) => d.code === "core.input.invalid-development")).toBe(true);
        }
    });
});

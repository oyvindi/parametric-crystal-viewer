import { describe, it, expect } from "vitest";
import { generateCrystal, getPointOperationRegistryEntry, type GeometryResult } from "@crystal/core";
import { ALBITE, GYPSUM, FORSTERITE, BERYL, createCrystalInput, listMinerals } from "./index.js";
import type { Mineral } from "./types.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

const SCALE = 10;

interface Spec {
    readonly mineral: Mineral;
    readonly crystalSystem: string;
    readonly pointGroup: string;
    readonly setting: string;
    readonly registryId: string;
    readonly order: number;
}

const SPECS: readonly Spec[] = [
    { mineral: ALBITE, crystalSystem: "triclinic", pointGroup: "-1", setting: "triclinic-standard", registryId: "point-group:-1:triclinic-standard", order: 2 },
    { mineral: GYPSUM, crystalSystem: "monoclinic", pointGroup: "2/m", setting: "monoclinic-b", registryId: "point-group:2/m:monoclinic-b", order: 4 },
    { mineral: FORSTERITE, crystalSystem: "orthorhombic", pointGroup: "mmm", setting: "orthorhombic-standard", registryId: "point-group:mmm:orthorhombic-standard", order: 8 },
    { mineral: BERYL, crystalSystem: "hexagonal", pointGroup: "6/mmm", setting: "hexagonal-standard", registryId: "point-group:6/mmm:hexagonal-standard", order: 24 },
];

describe("all seven crystal systems are represented in the catalog", () => {
    it("includes the four new minerals alongside the original five", () => {
        const ids = listMinerals();
        expect(ids).toContain("albite");
        expect(ids).toContain("gypsum");
        expect(ids).toContain("forsterite");
        expect(ids).toContain("beryl");
    });
});

for (const spec of SPECS) describe(`${spec.mineral.id} (${spec.crystalSystem})`, () => {
    const m = spec.mineral;

    it("has correct crystal system, point group, and setting", () => {
        expect(m.crystallography.crystalSystem).toBe(spec.crystalSystem);
        expect(m.crystallography.pointGroup).toBe(spec.pointGroup);
        expect(m.crystallography.setting).toBe(spec.setting);
    });

    it("references the matching point-group registry entry with the expected order", () => {
        const entry = getPointOperationRegistryEntry(spec.registryId);
        expect(entry).toBeDefined();
        expect(entry!.operations).toHaveLength(spec.order);
    });

    it("has at least two documented named habits", () => {
        expect(m.habits.length).toBeGreaterThanOrEqual(2);
        for (const habit of m.habits) {
            expect(habit.id).toBeTruthy();
            expect(habit.name).toBeTruthy();
            expect(habit.description).toBeTruthy();
            expect(habit.forms.length).toBeGreaterThan(0);
        }
    });

    it("has reported crystallographic provenance with a COD reference", () => {
        const reported = m.provenance.find((p) => p.status === "reported" && p.coverage.includes("crystallography"));
        expect(reported).toBeDefined();
        expect(reported!.referenceIds!.length).toBeGreaterThan(0);
    });

    for (const habit of m.habits) it(`generates valid geometry for the ${habit.id} habit`, () => {
        const input = createCrystalInput(m, { habitId: habit.id, morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        expect(geometry.faces.length).toBeGreaterThan(0);
    });

    it("produces visibly different geometries across habits", () => {
        const faceCounts = m.habits.map((habit) => {
            const input = createCrystalInput(m, { habitId: habit.id, morphologyScale: SCALE });
            return valid(generateCrystal(input.crystallography, input.morphology)).faces.length;
        });
        expect(new Set(faceCounts).size).toBeGreaterThan(1);
    });
});

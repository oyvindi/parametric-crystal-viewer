import { describe, it, expect } from "vitest";
import { generateCrystal, getPointOperationRegistryEntry, type GeometryResult } from "@crystal/core";
import { CALCITE, PYRITE, ANATASE, getMineral, listMinerals, createCrystalInput, resolveHabit } from "./index.js";
import type { Mineral } from "./types.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

const SCALE = 10;

interface Spec {
    readonly mineral: Mineral;
    readonly crystalRefId: string;
    readonly morphologyRefId: string;
    readonly registryId: string;
    readonly order: number;
    readonly habits: { readonly id: string; readonly activeForm: string; readonly secondaryForm: string }[];
}

const SPECS: readonly Spec[] = [
    {
        mineral: CALCITE, crystalRefId: "cod-9000095", morphologyRefId: "calcite-morphology",
        registryId: "point-group:-3m:hexagonal-standard", order: 12,
        habits: [
            { id: "rhombohedral", activeForm: "r", secondaryForm: "v" },
            { id: "scalenohedral", activeForm: "v", secondaryForm: "r" },
        ],
    },
    {
        mineral: PYRITE, crystalRefId: "cod-9000594", morphologyRefId: "pyrite-morphology",
        registryId: "point-group:m-3:cubic-standard", order: 24,
        habits: [
            { id: "cubic", activeForm: "a", secondaryForm: "e" },
            { id: "pyritohedral", activeForm: "e", secondaryForm: "a" },
        ],
    },
    {
        mineral: ANATASE, crystalRefId: "cod-9015929", morphologyRefId: "anatase-morphology",
        registryId: "point-group:4/mmm:tetragonal-standard", order: 16,
        habits: [
            { id: "dipyramidal", activeForm: "p", secondaryForm: "c" },
            { id: "tabular", activeForm: "c", secondaryForm: "p" },
        ],
    },
];

for (const spec of SPECS) describe(`M5 ${spec.mineral.id} provenance and habit coverage`, () => {
    const m = spec.mineral;

    it("has a stable ID, name, formula, and data revision", () => {
        expect(m.id).toBe(m.id.toLowerCase());
        expect(m.name).toBeTruthy();
        expect(m.formula).toBeTruthy();
        expect(m.dataRevision).toBeTruthy();
    });

    it("is registered in the catalog", () => {
        expect(listMinerals()).toContain(m.id);
        expect(getMineral(m.id)).toBe(m);
        expect(getMineral("unknown")).toBeUndefined();
    });

    it("provides traceable source references for crystallographic and morphology data", () => {
        expect(m.references).toBeDefined();
        const crystalRef = m.references!.find((r) => r.id === spec.crystalRefId);
        expect(crystalRef).toBeDefined();
        expect(crystalRef!.url).toBeTruthy();
        const morphologyRef = m.references!.find((r) => r.id === spec.morphologyRefId);
        expect(morphologyRef).toBeDefined();
        expect(morphologyRef!.url).toBeTruthy();
    });

    it("provenance distinguishes reported crystallography from curated morphology", () => {
        const provenance = m.provenance!;
        const reported = provenance.find((p) => p.status === "reported" && p.coverage.includes("crystallography"))!;
        expect(reported.referenceIds).toContain(spec.crystalRefId);

        const reportedForms = provenance.find((p) => p.status === "reported" && p.coverage.some((c) => c.includes("forms")))!;
        expect(reportedForms.referenceIds).toContain(spec.morphologyRefId);

        const curated = provenance.find((p) => p.status === "curated")!;
        expect(curated.coverage.some((c) => c.includes("development") || c === "habits")).toBe(true);
        expect(curated.derivation).toBeTruthy();
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

    it("references the matching point-group registry entry with the expected order", () => {
        const entry = getPointOperationRegistryEntry(spec.registryId);
        expect(entry).toBeDefined();
        expect(entry!.operations).toHaveLength(spec.order);
    });
});

for (const spec of SPECS) describe(`M5 ${spec.mineral.id} habit geometry`, () => {
    const m = spec.mineral;

    for (const habit of spec.habits) it(`generates valid geometry for the ${habit.id} habit`, () => {
        const input = createCrystalInput(m, { habitId: habit.id, morphologyScale: SCALE });
        const geometry = valid(generateCrystal(input.crystallography, input.morphology));
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has(habit.activeForm)).toBe(true);
    });

    it("produces visibly different geometries across habits", () => {
        const faceCounts = spec.habits.map((habit) => {
            const input = createCrystalInput(m, { habitId: habit.id, morphologyScale: SCALE });
            return valid(generateCrystal(input.crystallography, input.morphology)).faces.length;
        });
        expect(new Set(faceCounts).size).toBeGreaterThan(1);
    });

    const primary = spec.habits[0]!;
    it(`enabling ${primary.secondaryForm} on the ${primary.id} habit adds its faces`, () => {
        const base = createCrystalInput(m, { habitId: primary.id, morphologyScale: SCALE });
        const withSecondary = createCrystalInput(m, {
            habitId: primary.id,
            formEnabled: { [primary.secondaryForm]: true },
            formDevelopment: { [primary.secondaryForm]: 0.8 },
            morphologyScale: SCALE,
        });
        const geoBase = valid(generateCrystal(base.crystallography, base.morphology));
        const geoWith = valid(generateCrystal(withSecondary.crystallography, withSecondary.morphology));
        const before = geoBase.faces.filter((f) => f.contributors.some((c) => c.formId === primary.secondaryForm)).length;
        const after = geoWith.faces.filter((f) => f.contributors.some((c) => c.formId === primary.secondaryForm)).length;
        expect(after).toBeGreaterThan(before);
    });

    it("reports invalid geometry when all forms are disabled through the data path", () => {
        const habit = resolveHabit(m, primary.id);
        const allOff: Record<string, boolean> = {};
        for (const form of habit.forms) allOff[form.id] = false;
        const input = createCrystalInput(m, { habitId: primary.id, formEnabled: allOff, morphologyScale: SCALE });
        const result = generateCrystal(input.crystallography, input.morphology);
        expect(result.status).toBe("invalid");
        if (result.status === "invalid") {
            expect(result.diagnostics.some((d) => d.code === "core.geometry.no-active-forms")).toBe(true);
        }
    });
});

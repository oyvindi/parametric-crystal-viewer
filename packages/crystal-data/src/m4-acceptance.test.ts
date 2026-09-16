import { describe, expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import { createCrystalInput, createMineralCatalog, FLUORITE, QUARTZ, loadMineral, MineralDataError, validateMineral, validatePreferredView } from "./index.js";

const record = (): any => structuredClone(FLUORITE);
const codes = (value: unknown) => validateMineral(value).diagnostics.map((d) => d.code);

describe("M4 record boundary", () => {
    it("loads all shipped habits and variants through the validated generic path", () => {
        for (const source of [FLUORITE, QUARTZ]) {
            expect(loadMineral(source.id)).toEqual(loadMineral(structuredClone(source)));
            for (const habit of source.habits) for (const variantId of [undefined, ...(source.variants?.map((v) => v.id) ?? [])]) {
                const input = createCrystalInput(loadMineral(source), { habitId: habit.id, variantId });
                expect(generateCrystal(input.crystallography, input.morphology).status).toBe("valid");
            }
        }
    });

    it("adds a provisional record to an isolated catalog without mineral-specific code", () => {
        const source = {
            id: "provisional-fixture", name: "Synthetic enclosing-plane fixture", formula: "X", dataRevision: "fixture-1",
            crystallography: { crystalSystem: "orthorhombic", unitCell: { a: 3, b: 4, c: 5, alpha: 90, beta: 90, gamma: 90 }, identityOnly: true },
            habits: [{ id: "box", name: "Box", description: "Synthetic test input, not a sourced mineral habit.", forms:
                [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([h, k, l], i) => ({ id: `plane-${i}`, indices: { notation: "miller", h, k, l }, development: 1 })),
            }],
            references: [],
            provenance: [{ coverage: ["crystallography", "habits"], status: "curated", derivation: "Synthetic numeric fixture for the generic data path; does not count toward mineral or crystal-system acceptance coverage." }],
        };
        const catalog = createMineralCatalog([source]);
        expect(catalog.ok).toBe(true);
        if (!catalog.ok) return;
        expect(catalog.value.listMinerals()).toEqual([source.id]);
        const mineral = loadMineral(source.id, catalog.value);
        const input = createCrystalInput(mineral);
        expect(generateCrystal(input.crystallography, input.morphology).status).toBe("valid");
        expect(() => loadMineral(source.id)).toThrow(MineralDataError);
    });

    it("rejects duplicate identities atomically", () => {
        expect(createMineralCatalog(null).ok).toBe(false);
        const catalog = createMineralCatalog([FLUORITE, FLUORITE]);
        expect(catalog.ok).toBe(false);
        expect(catalog.diagnostics).toContainEqual(expect.objectContaining({ code: "data.record.duplicate-id", path: "/1/id" }));
        const source = record();
        source.habits.push(source.habits[0]);
        expect(codes(source)).toContain("data.record.duplicate-id");
    });

    it.each([null, [], 12, {}, { habits: [null], crystallography: { unitCell: null } }])("reports malformed input without untyped exceptions: %j", (source) => {
        expect(validateMineral(source).ok).toBe(false);
        expect(() => loadMineral(source)).toThrow(MineralDataError);
    });

    it("collects independent malformed fields and scientific errors deterministically", () => {
        const source = record();
        source.name = "";
        source.crystallography.unitCell.a = -1;
        source.habits[0].forms[0].development = -1;
        const first = validateMineral(source);
        expect(first).toEqual(validateMineral(source));
        expect(first.diagnostics.map((d) => d.path)).toEqual(expect.arrayContaining(["/name", "/crystallography/unitCell/a", "/habits/0/forms/0/development"]));
    });

    it("validates symmetry and every variant, and guards malformed operations", () => {
        const source = record();
        source.crystallography.pointOperations = [{ id: "broken", linear: [null] }];
        expect(codes(source)).toContain("data.record.invalid-field");
        delete source.crystallography.pointOperations;
        source.crystallography.pointGroup = "unsupported";
        expect(codes(source)).toContain("core.symmetry.unsupported-registry");
        const quartz: any = structuredClone(QUARTZ);
        quartz.variants[1].crystallography.unitCell.gamma = 90;
        const result = validateMineral(quartz);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((d) => d.path?.startsWith("/variants/1/crystallography"))).toBe(true);
    });

    it("requires revisions, resolvable references, origins and scientific coverage", () => {
        const missingRevision = record();
        delete missingRevision.dataRevision;
        expect(codes(missingRevision)).toContain("data.record.invalid-field");
        const missingReference = record();
        missingReference.habits[0].references = [{ id: "missing" }];
        expect(codes(missingReference)).toContain("data.record.invalid-reference");
        const missingOrigin = record();
        delete missingOrigin.provenance[1].derivation;
        expect(codes(missingOrigin)).toContain("data.record.invalid-provenance");
        const missingCoverage = record();
        missingCoverage.provenance[1].coverage = ["habits.*.forms.*.development"];
        expect(codes(missingCoverage)).toContain("data.record.invalid-provenance");
        const badCoverage = record();
        badCoverage.provenance[0].coverage = ["not.a.field"];
        expect(codes(badCoverage)).toContain("data.record.invalid-provenance");
        const derived = record();
        derived.provenance[1].status = "derived";
        expect(codes(derived)).toContain("data.record.invalid-provenance");
    });

    it("accepts granular provenance coverage as well as grouped entries", () => {
        const source = record();
        source.provenance[0].coverage = ["a", "b", "c", "alpha", "beta", "gamma"].map((key) => `crystallography.unitCell.${key}`);
        source.provenance[0].coverage.push("crystallography.crystalSystem", "crystallography.pointGroup", "crystallography.spaceGroup");
        expect(validateMineral(source).ok).toBe(true);
    });

    it("rejects sparse arrays and cyclic malformed records without throwing", () => {
        const source = record();
        source.habits[0].preferredView = { cameraDirection: new Array(3) };
        expect(validateMineral(source).ok).toBe(false);
        delete source.habits[0].preferredView;
        source.crystallography.pointOperations = new Array(2);
        expect(validateMineral(source).ok).toBe(false);
        source.crystallography = source;
        expect(validateMineral(source).ok).toBe(false);
    });

    it("normalizes supported units while preserving source units and geometry", () => {
        const source = record();
        for (const key of ["a", "b", "c"]) source.crystallography.unitCell[key] /= 10;
        source.crystallography.unitCell.lengthUnit = "nanometre";
        const mineral = loadMineral(source);
        expect(mineral.crystallography.unitCell.a).toBeCloseTo(FLUORITE.crystallography.unitCell.a);
        expect(mineral.crystallography.unitCell.lengthUnit).toBe("angstrom");
        expect(mineral.crystallography.sourceLengthUnit).toBe("nanometre");
        const input = createCrystalInput(mineral);
        const baseline = createCrystalInput(FLUORITE);
        expect(generateCrystal(input.crystallography, input.morphology)).toEqual(generateCrystal(baseline.crystallography, baseline.morphology));
        source.crystallography.unitCell.lengthUnit = "unknown";
        expect(validateMineral(source).ok).toBe(false);
    });

    it("freezes detached snapshots and rejects unknown schema fields", () => {
        const source = record();
        const mineral = loadMineral(source);
        source.habits[0].forms[0].development = 0;
        expect(mineral.habits[0].forms[0].development).toBe(1);
        expect(Object.isFrozen(mineral.habits[0].forms[0])).toBe(true);
        expect(() => { (mineral as any).id = "changed"; }).toThrow();
        source.habits[0].forms[0].developmnt = 1;
        expect(validateMineral(source).ok).toBe(false);
    });

    it("accepts scientific records whose morphology is unbounded or disabled", () => {
        const source = record();
        source.habits[0].forms.forEach((form: any) => { form.enabled = false; });
        const input = createCrystalInput(loadMineral(source));
        expect(generateCrystal(input.crystallography, input.morphology).diagnostics[0].code).toBe("core.geometry.no-active-forms");
    });

    it("reports unknown requests through typed diagnostics and does not modify presets", () => {
        for (const request of [{ habitId: "missing" }, { variantId: "missing" }, { formDevelopment: { missing: 1 } }]) {
            expect(() => createCrystalInput(FLUORITE, request)).toThrow(MineralDataError);
        }
        const input = createCrystalInput(FLUORITE, { formDevelopment: { a: 0.7 }, formEnabled: { o: true } });
        expect(input.morphology.forms[0].development).toBe(0.7);
        expect(FLUORITE.habits[0].forms[0].development).toBe(1);
    });
});

describe("M3 preferred-view validation", () => {
    it.each([
        { cameraDirection: [0, 0, 0] },
        { cameraDirection: [NaN, 1, 0] },
        { cameraDirection: [1, 0] },
        { cameraDirection: [0, 0, 1], upDirection: [0, 0, -2] },
        { cameraDirection: [0, 0, 1], upDirection: [0, 0, 0] },
    ])("rejects invalid or parallel vectors: %j", (view) => {
        expect(validatePreferredView(view)[0].code).toBe("data.record.invalid-preferred-view");
        const source = record();
        source.habits[0].preferredView = view;
        expect(validateMineral(source).ok).toBe(false);
    });

    it("accepts finite non-parallel vectors regardless of magnitude", () => {
        expect(validatePreferredView({ cameraDirection: [1e300, 1e300, 0], upDirection: [0, 0, 1e-300] })).toEqual([]);
    });
});

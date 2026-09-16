import { describe, it, expect } from "vitest";
import {
    createLattice,
    validateMillerIndices,
    transformMillerIndices,
    millerBravaisToMiller,
    millerToMillerBravais,
    resolvePointOperations,
    expandEquivalentPlaneDirections,
    generateCrystal,
    getPointOperationRegistryEntry,
    type GeometryResult,
} from "./index.js";

function valid(result: GeometryResult) {
    expect(result.status, JSON.stringify(result.diagnostics)).toBe("valid");
    if (result.status !== "valid") throw Error("Invalid fixture");
    return result.geometry;
}

const QUARTZ_CELL = { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 };

describe("M3 Miller-Bravais conversion", () => {
    it("converts Miller-Bravais to three-index by dropping i", () => {
        const mb = { notation: "miller-bravais" as const, h: 1, k: 0, i: -1, l: 1 };
        expect(millerBravaisToMiller(mb)).toEqual({ notation: "miller", h: 1, k: 0, l: 1 });
    });

    it("converts three-index to Miller-Bravais with i = -(h+k)", () => {
        const m = { notation: "miller" as const, h: 0, k: 1, l: 1 };
        expect(millerToMillerBravais(m)).toEqual({ notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 });
    });

    it("round-trips through three-index and back", () => {
        const mb = { notation: "miller-bravais" as const, h: 1, k: 1, i: -2, l: 0 };
        const m = millerBravaisToMiller(mb);
        const back = millerToMillerBravais(m);
        expect(back).toEqual(mb);
    });

    it("rejects invalid i in Miller-Bravais input", () => {
        const invalid = validateMillerIndices(
            { notation: "miller-bravais", h: 1, k: 0, i: 0, l: 1 },
            { crystalSystem: "trigonal" },
        );
        expect(invalid.ok).toBe(false);
        if (!invalid.ok) {
            expect(invalid.diagnostics[0]!.path).toBe("/i");
        }
    });

    it("rejects Miller-Bravais with an incompatible crystal system", () => {
        const invalid = validateMillerIndices(
            { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 },
            { crystalSystem: "cubic" },
        );
        expect(invalid.ok).toBe(false);
    });

    it("transforms Miller-Bravais indices through a trigonal operation", () => {
        const c3 = [[0, -1, 0], [1, -1, 0], [0, 0, 1]] as const;
        const result = transformMillerIndices(
            { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 },
            c3,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.notation).toBe("miller-bravais");
            if (result.value.notation === "miller-bravais") {
                expect(result.value.i).toBe(-(result.value.h + result.value.k));
            }
        }
    });
});

describe("M3 trigonal point group 32", () => {
    it("resolves the trigonal 32 registry for a hexagonal cell", () => {
        const lattice = createLattice(QUARTZ_CELL);
        if (!lattice.ok) throw new Error("Expected valid quartz lattice");
        const resolved = resolvePointOperations(
            { registryId: "point-group:32:hexagonal" },
            lattice.value,
        );
        expect(resolved.ok).toBe(true);
        if (resolved.ok) {
            expect(resolved.value).toHaveLength(6);
        }
    });

    it("validates group laws and metric compatibility for point group 32", () => {
        const lattice = createLattice(QUARTZ_CELL);
        if (!lattice.ok) throw new Error("Expected valid quartz lattice");
        const entry = getPointOperationRegistryEntry("point-group:32:hexagonal")!;
        const result = resolvePointOperations(
            { operations: entry.operations },
            lattice.value,
        );
        expect(result.ok).toBe(true);
    });

    it("rejects trigonal 32 with a non-hexagonal cell metric", () => {
        const cubicLattice = createLattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
        if (!cubicLattice.ok) throw new Error("Expected valid cubic lattice");
        const entry = getPointOperationRegistryEntry("point-group:32:hexagonal")!;
        const result = resolvePointOperations(
            { operations: entry.operations },
            cubicLattice.value,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.diagnostics.some((d) => d.code === "core.symmetry.metric-incompatible")).toBe(true);
        }
    });

    it("expands the prism form {10-10} into six oriented plane directions", () => {
        const lattice = createLattice(QUARTZ_CELL);
        if (!lattice.ok) throw new Error("Expected valid quartz lattice");
        const symmetry = resolvePointOperations(
            { registryId: "point-group:32:hexagonal" },
            lattice.value,
        );
        if (!symmetry.ok) throw new Error("Expected valid trigonal symmetry");
        const planes = expandEquivalentPlaneDirections(
            { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 },
            symmetry.value,
            lattice.value,
        );
        expect(planes.ok).toBe(true);
        if (!planes.ok) return;
        // The prism {10-10} under 32 generates 6 faces: 3 from the +h side, 3 from the -h side
        // (the 2-fold axes generate the opposite faces).
        expect(planes.value).toHaveLength(6);
        expect(planes.value.every((p) => p.indices.notation === "miller-bravais")).toBe(true);
    });

    it("expands the positive rhombohedron {10-11} into six oriented faces", () => {
        const lattice = createLattice(QUARTZ_CELL);
        if (!lattice.ok) throw new Error("Expected valid quartz lattice");
        const symmetry = resolvePointOperations(
            { registryId: "point-group:32:hexagonal" },
            lattice.value,
        );
        if (!symmetry.ok) throw new Error("Expected valid trigonal symmetry");
        const planes = expandEquivalentPlaneDirections(
            { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 },
            symmetry.value,
            lattice.value,
        );
        expect(planes.ok).toBe(true);
        if (!planes.ok) return;
        expect(planes.value).toHaveLength(6);
    });
});

describe("M3 quartz geometry through the generic core contract", () => {
    const quartzCrystallography = {
        crystalSystem: "trigonal" as const,
        pointGroup: "32",
        setting: "hexagonal-standard",
        spaceGroup: "P3_121",
        unitCell: QUARTZ_CELL,
    };

    it("generates a valid prism+rhombohedron quartz crystal", () => {
        const result = generateCrystal(quartzCrystallography, {
            forms: [
                { id: "m", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0.8 },
                { id: "z", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 0.5, enabled: false },
            ],
            morphologyScale: 10,
        });
        const geometry = valid(result);
        expect(geometry.faces.length).toBeGreaterThanOrEqual(12);
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("m")).toBe(true);
        expect(formIds.has("r")).toBe(true);
    });

    it("generates a valid prism with both rhombohedra", () => {
        const result = generateCrystal(quartzCrystallography, {
            forms: [
                { id: "m", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0.8 },
                { id: "z", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 0.8 },
            ],
            morphologyScale: 10,
        });
        const geometry = valid(result);
        const formIds = new Set(geometry.faces.flatMap((f) => f.contributors.map((c) => c.formId)));
        expect(formIds.has("m")).toBe(true);
        expect(formIds.has("r")).toBe(true);
        expect(formIds.has("z")).toBe(true);
    });

    it("reports invalid geometry when only the prism is active (unbounded)", () => {
        const result = generateCrystal(quartzCrystallography, {
            forms: [
                { id: "m", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0, enabled: false },
                { id: "z", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 0, enabled: false },
            ],
            morphologyScale: 10,
        });
        expect(result.status).toBe("invalid");
        if (result.status === "invalid") {
            expect(result.diagnostics.some((d) => d.code === "core.geometry.unbounded")).toBe(true);
        }
    });

    it("preserves Miller-Bravais notation in face contributor indices", () => {
        const result = generateCrystal(quartzCrystallography, {
            forms: [
                { id: "r", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 1 },
            ],
            morphologyScale: 10,
        });
        const geometry = valid(result);
        const rFace = geometry.faces.find((f) => f.contributors.some((c) => c.formId === "r"));
        expect(rFace).toBeDefined();
        const contributor = rFace!.contributors.find((c) => c.formId === "r")!;
        expect(contributor.indices?.notation).toBe("miller-bravais");
        if (contributor.indices?.notation === "miller-bravais") {
            expect(contributor.indices.i).toBe(-(contributor.indices.h + contributor.indices.k));
        }
    });
});

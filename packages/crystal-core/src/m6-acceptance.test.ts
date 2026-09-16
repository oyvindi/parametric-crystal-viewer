import { describe, expect, it } from "vitest";
import { createLattice, expandAtomicStructure, inferBonds, validatePeriodicBonds, validateSpaceOperations, type AtomicStructure, type SpaceOperation, type Mat3, type Vec3 } from "./index.js";

const cubicResult = createLattice({ a: 5, b: 5, c: 5, alpha: 90, beta: 90, gamma: 90 });
if (!cubicResult.ok) throw Error("cubic lattice");
const cubic = cubicResult.value;
const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const INVERSION: Mat3 = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];

// P -1 space operations: identity and inversion through the origin.
const pBar1: SpaceOperation[] = [
    { id: "1", linear: IDENTITY, translation: [0, 0, 0] as unknown as Vec3 },
    { id: "-1", linear: INVERSION, translation: [0, 0, 0] as unknown as Vec3 },
];

describe("M6 symmetry expansion", () => {
    it("expands a general asymmetric site into the expected complete reference cell", () => {
        const structure: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "X", element: "C", position: [0.1, 0.2, 0.3] }] };
        const expanded = expandAtomicStructure(structure, pBar1, cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        // General position under -1 has multiplicity 2.
        expect(expanded.value).toHaveLength(2);
        const positions = expanded.value.map((a) => [...a.position].map((v) => Number(v.toFixed(3))).join(",")).sort();
        expect(positions).toEqual(["0.1,0.2,0.3", "0.9,0.8,0.7"]);
    });

    it("does not duplicate atoms when multiple operations produce the same image", () => {
        // A site on the inversion centre: both operations map to (0,0,0).
        const structure: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "Ca", element: "Ca", position: [0, 0, 0] }] };
        const expanded = expandAtomicStructure(structure, pBar1, cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        expect(expanded.value).toHaveLength(1);
        // The single merged atom retains both originating operation IDs.
        expect(expanded.value[0]!.operationIds.slice().sort()).toEqual(["-1", "1"]);
    });

    it("does not expand complete-cell data a second time", () => {
        const sites = [{ id: "A", element: "C", position: [0.1, 0.2, 0.3] as unknown as Vec3 }, { id: "B", element: "C", position: [0.9, 0.8, 0.7] as unknown as Vec3 }];
        const structure: AtomicStructure = { siteRepresentation: "complete-cell", sites };
        const expanded = expandAtomicStructure(structure, pBar1, cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        // Complete-cell keeps the supplied sites (wrapped) without symmetry multiplication.
        expect(expanded.value).toHaveLength(2);
        expect(expanded.value.every((a) => a.operationIds.includes("complete"))).toBe(true);
    });

    it("preserves distinct partially occupied coincident sites as separate atoms", () => {
        // Two distinct source records at the same position with different occupancies
        // represent alternative disorder and must not be merged.
        const sites = [
            { id: "Fe1", element: "Fe", position: [0.5, 0.5, 0.5] as unknown as Vec3, occupancy: 0.6 },
            { id: "Mn1", element: "Mn", position: [0.5, 0.5, 0.5] as unknown as Vec3, occupancy: 0.4 },
        ];
        const structure: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites };
        const expanded = expandAtomicStructure(structure, [{ id: "1", linear: IDENTITY, translation: [0, 0, 0] as unknown as Vec3 }], cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        expect(expanded.value).toHaveLength(2);
        const occ = expanded.value.map((a) => a.occupancy).sort();
        expect(occ).toEqual([0.4, 0.6]);
        const elements = expanded.value.map((a) => a.element).sort();
        expect(elements).toEqual(["Fe", "Mn"]);
    });

    it("rejects out-of-range occupancy and non-finite positions", () => {
        const bad: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "X", element: "C", position: [0.1, 0.2, 0.3], occupancy: 1.5 }] };
        expect(expandAtomicStructure(bad, pBar1, cubic).ok).toBe(false);
        const bad2: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "X", element: "C", position: [NaN, 0, 0] as unknown as Vec3 }] };
        expect(expandAtomicStructure(bad2, pBar1, cubic).ok).toBe(false);
    });

    it("rejects asymmetric-unit expansion without space operations", () => {
        const structure: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "X", element: "C", position: [0, 0, 0] }] };
        expect(expandAtomicStructure(structure, [], cubic).ok).toBe(false);
    });
});

describe("M6 periodic bonds", () => {
    it("connects the correct images across cell boundaries and labels bonds as derived", () => {
        // Two atoms in adjacent cells along a: a bond should reference a cell offset of [1,0,0].
        const structure: AtomicStructure = {
            siteRepresentation: "complete-cell",
            sites: [
                { id: "A", element: "C", position: [0.0, 0.5, 0.5] },
                { id: "B", element: "C", position: [0.9, 0.5, 0.5] },
            ],
        };
        const expanded = expandAtomicStructure(structure, [], cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        const bonds = inferBonds(expanded.value, cubic);
        expect(bonds.length).toBeGreaterThan(0);
        expect(bonds.every((b) => b.derived === true)).toBe(true);
        // At least one bond crosses a cell boundary (non-zero cell offset on b).
        const crossing = bonds.find((b) => b.b.cellOffset.some((v) => v !== 0));
        expect(crossing).toBeDefined();
        if (crossing) expect(crossing.a.cellOffset).toEqual([0, 0, 0]);
    });

    it("permits an atoms-only view when no bonds are inferred", () => {
        // Place atoms far apart so no bonds form within the covalent cutoff.
        const structure: AtomicStructure = {
            siteRepresentation: "complete-cell",
            sites: [{ id: "A", element: "Na", position: [0, 0, 0] }, { id: "B", element: "Cl", position: [0.5, 0.5, 0.5] }],
        };
        const expanded = expandAtomicStructure(structure, [], cubic);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        const bonds = inferBonds(expanded.value, cubic, { factor: 0.1 });
        expect(bonds).toHaveLength(0);
        // Atoms are still present for an atoms-only view.
        expect(expanded.value.length).toBeGreaterThan(0);
    });

    it("rejects supplied bonds with unresolved atom IDs or non-integer cell offsets", () => {
        const structure: AtomicStructure = { siteRepresentation: "complete-cell", sites: [{ id: "A", element: "C", position: [0, 0, 0] }] };
        const expanded = expandAtomicStructure(structure, [], cubic);
        if (!expanded.ok) throw Error("expand");
        const invalid = validatePeriodicBonds([{ a: { siteId: "missing", cellOffset: [0, 0, 0] }, b: { siteId: "A", cellOffset: [0.5, 0, 0] } }], expanded.value);
        expect(invalid.ok).toBe(false);
        if (!invalid.ok) expect(invalid.diagnostics.map((d) => d.code)).toEqual(["core.atomic.invalid-bond", "core.atomic.invalid-bond"]);
    });
});

describe("M6 expansion validates space operations", () => {
    it("rejects an invalid space-operation set before expansion", () => {
        const structure: AtomicStructure = { siteRepresentation: "asymmetric-unit", sites: [{ id: "X", element: "C", position: [0.1, 0.2, 0.3] }] };
        // A non-closed set (identity only is closed, but missing the inversion inverse is fine for {1});
        // use a set lacking closure: identity + a 2-fold without its inverse pair structure.
        const bad: SpaceOperation[] = [
            { id: "1", linear: IDENTITY, translation: [0, 0, 0] as unknown as Vec3 },
            { id: "2", linear: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] as unknown as Mat3, translation: [0, 0, 0] as unknown as Vec3 },
            { id: "3", linear: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]] as unknown as Mat3, translation: [0, 0, 0] as unknown as Vec3 },
        ];
        const validated = validateSpaceOperations(bad, cubic);
        expect(validated.ok).toBe(false);
    });
});

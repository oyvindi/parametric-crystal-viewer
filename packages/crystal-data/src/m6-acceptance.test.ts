import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createLattice, expandAtomicStructure, inferBonds } from "@crystal/core";
import { importCif, parseSymmetryOperation, parseCifNumber, stripUncertainty } from "./import.js";

const fixture = (name: string) => readFileSync(new URL(`../test-fixtures/m6/${name}.cif`, import.meta.url), "utf8");
const codFixture = (id: string) => readFileSync(new URL(`../../crystal-core/test-fixtures/m5/${id}.cif`, import.meta.url), "utf8");

function latticeOf(a: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number }) {
    const r = createLattice(a);
    if (!r.ok) throw Error("lattice");
    return r.value;
}

function ok(text: string, options?: { blockId?: string }) {
    const r = importCif(text, options);
    expect(r.ok, JSON.stringify(r.diagnostics)).toBe(true);
    if (!r.ok) throw Error("import failed");
    return { definition: r.value, diagnostics: r.diagnostics };
}
function failed(text: string, options?: { blockId?: string }) {
    const r = importCif(text, options);
    expect(r.ok).toBe(false);
    return r.diagnostics;
}

describe("M6 value handling", () => {
    it("strips parenthesized uncertainty notation", () => {
        expect(stripUncertainty("5.463(2)")).toBe("5.463");
        expect(parseCifNumber("5.463(2)")).toBe(5.463);
    });
    it("treats ? and . as missing values", () => {
        expect(parseCifNumber("?")).toBeUndefined();
        expect(parseCifNumber(".")).toBeUndefined();
        expect(parseCifNumber(undefined)).toBeUndefined();
    });
    it("parses a symmetry operation expression", () => {
        const op = parseSymmetryOperation("2/3+x,1/3+y,1/3+z");
        expect(op).toBeDefined();
        if (!op) return;
        expect(op.linear[0]).toEqual([1, 0, 0]);
        expect(op.translation).toEqual([2 / 3, 1 / 3, 1 / 3]);
    });
});

describe("M6 representative CIF fixtures import successfully", () => {
    const cases: readonly { id: string; system: string; pointGroup: string; setting: string; ops: number; sites: number }[] = [
        { id: "9000095", system: "trigonal", pointGroup: "-3m", setting: "hexagonal-standard", ops: 36, sites: 3 },
        { id: "9000594", system: "cubic", pointGroup: "m-3", setting: "cubic-standard", ops: 24, sites: 2 },
        { id: "9015929", system: "tetragonal", pointGroup: "4/mmm", setting: "tetragonal-standard", ops: 32, sites: 2 },
        { id: "9000319", system: "orthorhombic", pointGroup: "mmm", setting: "orthorhombic-standard", ops: 8, sites: 6 },
        { id: "9013164", system: "monoclinic", pointGroup: "2/m", setting: "monoclinic-b", ops: 8, sites: 7 },
        { id: "9000993", system: "triclinic", pointGroup: "-1", setting: "triclinic-standard", ops: 4, sites: 13 },
    ];
    for (const c of cases) it(`imports COD ${c.id} as ${c.system} ${c.pointGroup}`, () => {
        const { definition } = ok(codFixture(c.id));
        expect(definition.crystallography.crystalSystem).toBe(c.system);
        expect(definition.crystallography.pointGroup).toBe(c.pointGroup);
        expect(definition.crystallography.setting).toBe(c.setting);
        expect(definition.crystallography.spaceOperations).toHaveLength(c.ops);
        expect(definition.atomicStructure.sites).toHaveLength(c.sites);
        expect(definition.atomicStructure.siteRepresentation).toBe("asymmetric-unit");
    });
    it("expands an imported structure to a complete reference cell and infers derived bonds", () => {
        const { definition } = ok(codFixture("9000594"));
        const lattice = latticeOf(definition.crystallography.unitCell);
        const expanded = expandAtomicStructure(definition.atomicStructure, definition.crystallography.spaceOperations ?? [], lattice);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        expect(expanded.value.length).toBeGreaterThan(definition.atomicStructure.sites.length);
        const bonds = inferBonds(expanded.value, lattice);
        expect(bonds.every((b) => b.derived === true)).toBe(true);
    });
});

describe("M6 multi-block selection", () => {
    it("requires explicit block selection when multiple structural blocks are present", () => {
        const d = failed(fixture("multi-block"));
        expect(d.some((x) => x.code === "data.cif.ambiguous-block")).toBe(true);
    });
    it("imports the selected structural block", () => {
        const { definition } = ok(fixture("multi-block"), { blockId: "block_a" });
        expect(definition.id).toBe("block_a");
        expect(definition.atomicStructure.sites).toHaveLength(1);
        const { definition: b } = ok(fixture("multi-block"), { blockId: "block_b" });
        expect(b.id).toBe("block_b");
        expect(b.atomicStructure.sites[0]!.element).toBe("O");
    });
    it("rejects an unknown block id", () => {
        const d = failed(fixture("multi-block"), { blockId: "block_x" });
        expect(d.some((x) => x.code === "data.cif.ambiguous-block")).toBe(true);
    });
});

describe("M6 uncertainty, missing values, and units", () => {
    it("imports a CIF with uncertainty notation and nanometre units normalized to Ångström", () => {
        const { definition } = ok(fixture("synthetic"));
        expect(definition.crystallography.unitCell.a).toBeCloseTo(5.0, 3);
        expect(definition.crystallography.pointGroup).toBe("-1");
        expect(definition.crystallography.setting).toBe("triclinic-standard");
        const { definition: nm } = ok(fixture("nanometre"));
        // 0.5 nm -> 5 Å
        expect(nm.crystallography.unitCell.a).toBeCloseTo(5.0, 6);
    });
    it("reports a diagnostic for a missing required coordinate", () => {
        const d = failed(fixture("missing-value"));
        expect(d.some((x) => x.code === "data.cif.missing-required")).toBe(true);
    });
    it("reports a diagnostic for a missing required unit-cell angle", () => {
        const d = failed(fixture("missing-cell"));
        expect(d.some((x) => x.code === "data.cif.missing-required")).toBe(true);
    });
});

describe("M6 site representation and occupancy", () => {
    it("preserves distinct partially occupied coincident sites", () => {
        const { definition } = ok(fixture("partial-occupancy"));
        const sites = definition.atomicStructure.sites;
        expect(sites).toHaveLength(2);
        const occ = sites.map((s) => s.occupancy).sort();
        expect(occ).toEqual([0.4, 0.6]);
        // Expansion keeps them separate (distinct source sites are never merged).
        const lattice = latticeOf(definition.crystallography.unitCell);
        const expanded = expandAtomicStructure(definition.atomicStructure, definition.crystallography.spaceOperations ?? [], lattice);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        const elements = expanded.value.map((a) => a.element).sort();
        expect(elements).toContain("Fe");
        expect(elements).toContain("Mn");
    });
    it("imports a complete-cell declaration without expanding a second time", () => {
        const { definition } = ok(fixture("complete-cell"));
        expect(definition.atomicStructure.siteRepresentation).toBe("complete-cell");
        expect(definition.crystallography.crystalSystem).toBe("cubic");
        const lattice = latticeOf(definition.crystallography.unitCell);
        const expanded = expandAtomicStructure(definition.atomicStructure, definition.crystallography.spaceOperations ?? [], lattice);
        expect(expanded.ok).toBe(true);
        if (!expanded.ok) return;
        expect(expanded.value).toHaveLength(2);
    });
    it("reports a diagnostic for an ambiguous site representation", () => {
        const d = failed(fixture("ambiguous"));
        expect(d.some((x) => x.code === "data.cif.ambiguous-site-representation")).toBe(true);
    });
});

describe("M6 symmetry identifiers", () => {
    it("resolves explicit operations and a supported identifier consistently", () => {
        const { definition } = ok(fixture("synthetic"));
        // The P -1 identifier agrees with the explicit operations.
        expect(definition.crystallography.pointGroup).toBe("-1");
        expect(definition.crystallography.spaceGroup).toBe("P -1");
    });
    it("rejects an unsupported identifier with no operation loop", () => {
        const d = failed(fixture("unsupported-sym"));
        expect(d.some((x) => x.code === "data.cif.unsupported-symmetry")).toBe(true);
    });
    it("rejects an identifier that conflicts with the explicit operations", () => {
        const d = failed(fixture("conflicting"));
        expect(d.some((x) => x.code === "data.cif.conflicting-symmetry")).toBe(true);
    });
});

describe("M6 bond data and unsupported formats", () => {
    it("reports supplied CIF bond data as omitted (V1 bond import is optional)", () => {
        const { definition, diagnostics } = ok(fixture("with-bonds"));
        expect(diagnostics.some((x) => x.code === "data.cif.bonds-omitted" && x.severity === "warning")).toBe(true);
        // Bonds are inferred instead and labelled derived.
        const lattice = latticeOf(definition.crystallography.unitCell);
        const expanded = expandAtomicStructure(definition.atomicStructure, definition.crystallography.spaceOperations ?? [], lattice);
        if (!expanded.ok) throw Error("expand");
        const bonds = inferBonds(expanded.value, lattice);
        expect(bonds.every((b) => b.derived === true)).toBe(true);
    });
    it("rejects CIF 2.0", () => {
        const d = failed(fixture("cif2"));
        expect(d.some((x) => x.code === "data.cif.unsupported-version")).toBe(true);
    });
});

describe("M6 provenance preservation", () => {
    it("preserves source metadata and distinguishes imported from inferred values", () => {
        const { definition } = ok(fixture("synthetic"));
        const reported = definition.provenance.filter((p) => p.status === "reported");
        expect(reported.length).toBeGreaterThan(0);
        // Crystallography and sites are reported (imported), with source references.
        const crystalProv = definition.provenance.find((p) => p.coverage.includes("crystallography.unitCell"));
        expect(crystalProv?.status).toBe("reported");
        expect(crystalProv?.referenceIds?.length).toBeGreaterThan(0);
        const siteProv = definition.provenance.find((p) => p.coverage.includes("atomicStructure.sites"));
        expect(siteProv?.status).toBe("reported");
        // Inferred bonds would be derived; provenance covers imported data only here.
        expect(definition.source.format).toBe("cif-1.1");
        expect(definition.source.blockId).toBe("synthetic");
    });
});

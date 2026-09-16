import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLattice, expandAtomicStructure, fractionalToCartesian, inferBonds } from "@crystal/core";
import { importCif } from "./import.js";

const source = (id: string) => readFileSync(new URL(
    ["9000775", "9009005"].includes(id) ? `../test-fixtures/cod/${id}.cif` : `../../crystal-core/test-fixtures/m5/${id}.cif`, import.meta.url), "utf8");
function expand(text: string) {
    const imported = importCif(text);
    if (!imported.ok) throw new Error(JSON.stringify(imported.diagnostics));
    const definition = imported.value;
    const lattice = createLattice(definition.crystallography.unitCell);
    if (!lattice.ok) throw new Error(JSON.stringify(lattice.diagnostics));
    const atoms = expandAtomicStructure(definition.atomicStructure, definition.crystallography.spaceOperations ?? [], lattice.value);
    if (!atoms.ok) throw new Error(JSON.stringify(atoms.diagnostics));
    return { definition, lattice: lattice.value, atoms: atoms.value };
}

describe("COD reference-cell regression cases", () => {
    // Independent expectations: each source's chemical formula multiplied by Z.
    const cases = [
        { id: "9000775", counts: { Si: 3, O: 6 } },
        { id: "9009005", counts: { Ca: 4, F: 8 } },
        { id: "9000095", counts: { Ca: 6, C: 6, O: 18 } },
        { id: "9000594", counts: { Fe: 4, S: 8 } },
        { id: "9000993", counts: { Na: 4, Al: 4, Si: 12, O: 32 } },
    ];
    for (const { id, counts } of cases) it(`expands COD ${id} to the expected element counts`, () => {
        const { atoms } = expand(source(id));
        const actual: Record<string, number> = {};
        for (const atom of atoms) actual[atom.element] = (actual[atom.element] ?? 0) + 1;
        expect(actual).toEqual(counts);
    });

    it("places quartz silicon at the three screw-related positions", () => {
        const { atoms } = expand(source("9000775"));
        const silicon = atoms.filter((a) => a.element === "Si");
        // Apply the source's screw operations by hand to (0.46970, 0, 0).
        for (const expected of [[0.46970, 0, 0], [0, 0.46970, 2 / 3], [0.53030, 0.53030, 1 / 3]]) {
            expect(silicon.some((a) => a.position.every((x, i) => Math.abs(x - expected[i]!) < 1e-10))).toBe(true);
        }
    });

    it("deduplicates fluorite special positions and preserves their operation attribution", () => {
        const { definition, atoms } = expand(source("9009005"));
        expect(definition.crystallography.spaceOperations).toHaveLength(192);
        const positions = (element: string) => atoms.filter((a) => a.element === element).map((a) => a.position.join(",")).sort();
        expect(positions("Ca")).toEqual(["0,0,0", "0,0.5,0.5", "0.5,0,0.5", "0.5,0.5,0"].sort());
        const fluorine = [];
        for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) fluorine.push(`${x},${y},${z}`);
        expect(positions("F")).toEqual(fluorine.sort());
        for (const atom of atoms) expect(new Set(atom.operationIds).size).toBe(atom.element === "Ca" ? 48 : 24);
    });

    it("has eight periodic nearest fluorine neighbours around calcium at sqrt(3)*a/4", () => {
        const { atoms, lattice } = expand(source("9009005"));
        const distances: number[] = [];
        // Reference calcium is at the origin. Include neighbouring cells explicitly.
        for (const atom of atoms.filter((a) => a.element === "F")) {
            for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
                distances.push(Math.hypot(...fractionalToCartesian(lattice.direct, [atom.position[0] + i, atom.position[1] + j, atom.position[2] + k])));
            }
        }
        distances.sort((a, b) => a - b);
        const expected = Math.sqrt(3) * 5.46295 / 4;
        for (const distance of distances.slice(0, 8)) expect(distance).toBeCloseTo(expected, 10);
        expect(distances[8]).toBeGreaterThan(expected + 0.1);
    });

    for (const [id, multiplicities] of [
        ["9000775", { Si: 3, O: 6 }], ["9009005", { Ca: 4, F: 8 }],
    ] as const) it(`multiplicity metadata leaves COD ${id} expansion unchanged`, () => {
        const original = source(id);
        // Synthetic derivative only: preserve the downloaded source byte-for-byte.
        let derivative = original.replace("_atom_site_fract_z\n", "_atom_site_fract_z\n_atom_site_symmetry_multiplicity\n");
        for (const [label, multiplicity] of Object.entries(multiplicities)) {
            derivative = derivative.replace(new RegExp(`^(${label}\\s+\\S+\\s+\\S+\\s+\\S+)\\s*$`, "m"), `$1 ${multiplicity}`);
        }
        expect(derivative).not.toBe(original);
        expect(expand(derivative).atoms).toEqual(expand(original).atoms);
    });

    it("normalizes equivalent angstrom and nanometre inputs through lattice, atoms and bonds", () => {
        const angstrom = source("9009005");
        // Synthetic unit-conversion derivative; source length is exactly 5.46295 Å.
        const nanometre = angstrom.replace(/(_cell_length_[abc]\s+)5\.46295/g, "$10.546295") + "\n_cell_length_units nanometre\n";
        const a = expand(angstrom);
        const nm = expand(nanometre);
        expect(nm.definition.source.lengthUnit).toBe("nanometre");
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
            expect(nm.lattice.direct[i]![j]).toBeCloseTo(a.lattice.direct[i]![j]!, 12);
        }
        expect(nm.lattice.volume).toBeCloseTo(a.lattice.volume, 10);
        expect(nm.atoms).toEqual(a.atoms);
        for (const atom of a.atoms) {
            const expected = fractionalToCartesian(a.lattice.direct, atom.position);
            fractionalToCartesian(nm.lattice.direct, atom.position).forEach((x, i) => expect(x).toBeCloseTo(expected[i]!, 12));
        }
        const bonds = inferBonds(a.atoms, a.lattice);
        expect(bonds.length).toBeGreaterThan(0);
        expect(bonds.some((b) => b.b.cellOffset.some((x) => x !== 0))).toBe(true);
        expect(inferBonds(nm.atoms, nm.lattice)).toEqual(bonds);
    });
});

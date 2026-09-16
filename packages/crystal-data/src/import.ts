import {
    createLattice, derivePointOperations, equivalentPointOperationSets, listPointOperationRegistryEntries,
    validateSpaceOperations, type CrystalSystem, type Diagnostic, type Mat3, type Result, type SpaceOperation, type Vec3,
    type AtomSite, type AtomicStructure, type SiteRepresentation,
} from "@crystal/core";
import type { CifBlock, CifFile, CifLoop } from "./cif.js";
import { parseCif } from "./cif.js";
import type { MineralCrystallography, MineralUnitCell, ProvenanceEntry, Reference, StructuralDefinition, ImportSource } from "./types.js";

export interface CifImportOptions {
    /** Required when the file contains multiple structural blocks; selects one by `data_` name. */
    readonly blockId?: string;
}

/** Normalize a Hermann–Mauguin symbol for table lookup: strip whitespace and `:` setting suffixes. */
function normalizeHm(hm: string): string {
    return hm.replace(/\s+/g, "").replace(/:.+$/, "");
}

/**
 * Maps normalized Hermann–Mauguin space-group symbols to supported registry identifiers.
 * Used to resolve symmetry when no explicit operation loop is supplied and to validate
 * identifiers against explicit operations.
 */
const HM_TABLE: Readonly<Record<string, string>> = {
    // m-3m cubic
    "Fm-3m": "point-group:m-3m:standard", "Fd-3m": "point-group:m-3m:standard", "Fm-3c": "point-group:m-3m:standard",
    "Fd-3c": "point-group:m-3m:standard", "Im-3m": "point-group:m-3m:standard", "Ia-3d": "point-group:m-3m:standard",
    "Pm-3m": "point-group:m-3m:standard", "Pn-3m": "point-group:m-3m:standard", "Pm-3n": "point-group:m-3m:standard", "Pn-3n": "point-group:m-3m:standard",
    // m-3 cubic
    "Pm-3": "point-group:m-3:cubic-standard", "Pn-3": "point-group:m-3:cubic-standard", "Pa-3": "point-group:m-3:cubic-standard",
    "Im-3": "point-group:m-3:cubic-standard", "Ia-3": "point-group:m-3:cubic-standard", "Fd-3": "point-group:m-3:cubic-standard", "Fm-3": "point-group:m-3:cubic-standard",
    // -3m trigonal hexagonal
    "R-3m": "point-group:-3m:hexagonal-standard", "R-3c": "point-group:-3m:hexagonal-standard",
    "P-3m1": "point-group:-3m:hexagonal-standard", "P-31m": "point-group:-3m:hexagonal-standard",
    "P-3c1": "point-group:-3m:hexagonal-standard", "P-31c": "point-group:-3m:hexagonal-standard",
    // 32 trigonal hexagonal
    "R32": "point-group:32:hexagonal-standard", "P312": "point-group:32:hexagonal-standard",
    "P321": "point-group:32:hexagonal-standard", "P3112": "point-group:32:hexagonal-standard", "P3121": "point-group:32:hexagonal-standard",
    // 4/mmm tetragonal
    "P4/mmm": "point-group:4/mmm:tetragonal-standard", "P4/mcc": "point-group:4/mmm:tetragonal-standard",
    "I4/mmm": "point-group:4/mmm:tetragonal-standard", "I4/mcm": "point-group:4/mmm:tetragonal-standard",
    "I41/amd": "point-group:4/mmm:tetragonal-standard", "I41/acd": "point-group:4/mmm:tetragonal-standard",
    "P4/mbm": "point-group:4/mmm:tetragonal-standard", "P4/mnc": "point-group:4/mmm:tetragonal-standard",
    // 6/mmm hexagonal
    "P6/mmm": "point-group:6/mmm:hexagonal-standard", "P6/mcc": "point-group:6/mmm:hexagonal-standard",
    "P63/mcm": "point-group:6/mmm:hexagonal-standard", "P63/mmc": "point-group:6/mmm:hexagonal-standard",
    // mmm orthorhombic
    "Pmmm": "point-group:mmm:orthorhombic-standard", "Pnma": "point-group:mmm:orthorhombic-standard",
    "Pbnm": "point-group:mmm:orthorhombic-standard", "Pbca": "point-group:mmm:orthorhombic-standard",
    "Cmcm": "point-group:mmm:orthorhombic-standard", "Cmca": "point-group:mmm:orthorhombic-standard",
    "Cmmm": "point-group:mmm:orthorhombic-standard", "Fddd": "point-group:mmm:orthorhombic-standard",
    "Immm": "point-group:mmm:orthorhombic-standard", "Pnnm": "point-group:mmm:orthorhombic-standard",
    // 2/m monoclinic (unique axis b)
    "P2/m": "point-group:2/m:monoclinic-b", "P21/m": "point-group:2/m:monoclinic-b",
    "C2/m": "point-group:2/m:monoclinic-b", "P2/c": "point-group:2/m:monoclinic-b",
    "P21/c": "point-group:2/m:monoclinic-b", "C2/c": "point-group:2/m:monoclinic-b",
    "I2/a": "point-group:2/m:monoclinic-b", "C12/c1": "point-group:2/m:monoclinic-b",
    // -1 triclinic
    "P-1": "point-group:-1:triclinic-standard", "C-1": "point-group:-1:triclinic-standard",
};

function classifyCrystalSystem(hm: string): CrystalSystem | undefined {
    const s = normalizeHm(hm);
    // Cubic: a 3-fold appears in the second symbol position (e.g. Pm-3m, Pa-3, Fd-3m).
    if (/[mnpcfdi]-?3[-mndc ]/.test(s) || /3[-mndc ]/.test(s.slice(2))) {
        if (/^[PRFIAaCc][mnpcfdi]?-?3/.test(s)) return "trigonal"; // 3/-3 in principal position
        return "cubic";
    }
    if (/^-?6/.test(s.slice(1)) || /^[PRFIAaCc]-?6/.test(s)) return "hexagonal";
    if (/^-?4/.test(s.slice(1)) || /^[PRFIAaCc]-?4/.test(s)) return "tetragonal";
    if (/^-?3/.test(s)) return "trigonal";
    // Monoclinic: a single 2/m direction.
    if (/2\/?m|^-?2|^-?m|2\/[ac]/.test(s)) return "monoclinic";
    if (/^-1$|P-1|C-1/.test(s)) return "triclinic";
    if (/mmm|222|mm2/.test(s)) return "orthorhombic";
    return undefined;
}

const SYMMETRY_TAGS = ["_space_group_symop_operation_xyz", "_symmetry_equiv_pos_as_xyz"];
const BOND_TAGS = ["_geom_bond_atom_site_label_1", "_geom_angle_atom_site_label_1", "_geom_bond_dist"];

function scalar(block: CifBlock, tags: readonly string[]): string | undefined {
    for (const tag of tags) {
        const v = block.scalars.get(tag) ?? block.scalars.get(tag.toLowerCase());
        if (v !== undefined) return v;
    }
    return undefined;
}

function loopFor(block: CifBlock, tag: string): CifLoop | undefined {
    return block.loops.find((l) => l.tags.some((t) => t === tag || t.toLowerCase() === tag.toLowerCase()));
}

/** Strips parenthesized CIF standard uncertainty, e.g. `5.463(2)` -> `5.463`. */
export function stripUncertainty(value: string): string {
    return value.replace(/\([^)]*\)$/, "");
}

/** Parses a CIF numeric, returning undefined for missing-value markers (`?` or `.`). */
export function parseCifNumber(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    if (trimmed === "?" || trimmed === "." || trimmed === "") return undefined;
    const n = Number(stripUncertainty(trimmed));
    return Number.isFinite(n) ? n : undefined;
}

function isMissing(value: string | undefined): boolean {
    return value === undefined || value === "?" || value === ".";
}

/** Parses a CIF symmetry operation expression `x,y,z` into a linear matrix and translation. */
export function parseSymmetryOperation(expr: string): { linear: Mat3; translation: Vec3 } | undefined {
    const parts = expr.split(",");
    if (parts.length !== 3) return undefined;
    const linear: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const translation: number[] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        const terms = parts[i]!.match(/[+-]?[^+-]+/g) ?? [];
        for (const term of terms) {
            const sign = term.startsWith("-") ? -1 : 1;
            const token = term.replace(/^[+-]/, "").trim();
            const axis = ["x", "y", "z"].indexOf(token);
            if (axis >= 0) linear[i]![axis]! += sign;
            else if (/^\d+(\/\d+)?$/.test(token)) {
                const [n, d = "1"] = token.split("/");
                translation[i]! += sign * (Number(n) / Number(d));
            } else return undefined;
        }
    }
    return { linear: linear as unknown as Mat3, translation: translation as unknown as Vec3 };
}

function elementFromLabel(label: string): string {
    const m = label.match(/^\s*([A-Za-z]{1,2})/);
    return m ? m[1]! : label;
}

function structuralBlocks(file: CifFile): CifBlock[] {
    return file.blocks.filter((b) => loopFor(b, "_atom_site_label"));
}

/** Imports a CIF 1.1 structural definition. Diagnostics carry warnings on success, errors on failure. */
export function importCif(text: string, options: CifImportOptions = {}): Result<StructuralDefinition> {
    const parsed = parseCif(text);
    if (!parsed.ok) return parsed;
    const diagnostics: Diagnostic[] = [];

    const blocks = structuralBlocks(parsed.value);
    if (!blocks.length) return fail("data.cif.missing-required", "No atom-site loop found; the file has no structural data.");
    let block: CifBlock;
    if (blocks.length > 1) {
        if (!options.blockId) return fail("data.cif.ambiguous-block", "Multiple structural blocks require explicit block selection.", { details: { blocks: blocks.map((b) => b.name) } });
        const selected = blocks.find((b) => b.name === options.blockId);
        if (!selected) return fail("data.cif.ambiguous-block", `No structural block named "${options.blockId}".`, { details: { blocks: blocks.map((b) => b.name) } });
        block = selected;
    } else {
        block = blocks[0]!;
        if (options.blockId && options.blockId !== block.name) return fail("data.cif.ambiguous-block", `No structural block named "${options.blockId}".`, { details: { blocks: [block.name] } });
    }

    // Unit cell (required).
    const a = parseCifNumber(scalar(block, ["_cell_length_a"]));
    const b = parseCifNumber(scalar(block, ["_cell_length_b"]));
    const c = parseCifNumber(scalar(block, ["_cell_length_c"]));
    const alpha = parseCifNumber(scalar(block, ["_cell_angle_alpha"]));
    const beta = parseCifNumber(scalar(block, ["_cell_angle_beta"]));
    const gamma = parseCifNumber(scalar(block, ["_cell_angle_gamma"]));
    const rawUnit = scalar(block, ["_cell_length_units", "_cell_measurement_units"]);
    if ([a, b, c, alpha, beta, gamma].some((v) => v === undefined)) return fail("data.cif.missing-required", "Unit-cell lengths and angles are required.");
    let lengthUnit: "angstrom" | "nanometre" | undefined;
    if (rawUnit !== undefined) {
        const u = rawUnit.toLowerCase();
        if (u === "angstrom" || u === "angstroms" || u === "a") lengthUnit = "angstrom";
        else if (u === "nanometre" || u === "nanometres" || u === "nm") lengthUnit = "nanometre";
        else return fail("data.cif.missing-required", `Unsupported cell length unit "${rawUnit}".`);
    }
    const factor = lengthUnit === "nanometre" ? 10 : 1;
    const unitCell: MineralUnitCell = { a: a! * factor, b: b! * factor, c: c! * factor, alpha: alpha!, beta: beta!, gamma: gamma!, ...(lengthUnit ? { lengthUnit } : {}) };
    const latticeResult = createLattice(unitCell);
    if (!latticeResult.ok) return { ok: false, diagnostics: latticeResult.diagnostics.map((d) => ({ ...d, code: "data.cif.missing-required", path: `/cell${d.path ?? ""}` })) };
    const lattice = latticeResult.value;

    // Symmetry: explicit operations (primary) and/or identifier.
    const symLoop = SYMMETRY_TAGS.map((t) => loopFor(block, t)).find((l): l is CifLoop => l !== undefined);
    const hmSymbol = scalar(block, ["_space_group_name_H-M_alt", "_symmetry_space_group_name_H-M", "_space_group_name_H-M"]);
    const hallSymbol = scalar(block, ["_space_group_name_Hall", "_symmetry_space_group_name_Hall"]);
    const itNumber = parseCifNumber(scalar(block, ["_space_group.IT_number", "_space_group_IT_number", "_symmetry_Int_Tables_number"]));
    const crystalSystemTag = scalar(block, ["_space_group_crystal_system", "_symmetry_cell_setting"]);

    let spaceOperations: SpaceOperation[] | undefined;
    if (symLoop) {
        const opCol = symLoop.tags.findIndex((t) => SYMMETRY_TAGS.includes(t) || SYMMETRY_TAGS.includes(t.toLowerCase()));
        const idCol = symLoop.tags.findIndex((t) => t === "_space_group_symop_id" || t.toLowerCase() === "_space_group_symop_id");
        const ops: SpaceOperation[] = [];
        let ok = true;
        symLoop.rows.forEach((row, i) => {
            const expr = row[opCol];
            if (!expr) { diagnostics.push({ code: "data.cif.parse", severity: "error", message: `Symmetry operation ${i} is missing.`, source: { block: block.name } }); ok = false; return; }
            const parsed = parseSymmetryOperation(expr);
            if (!parsed) { diagnostics.push({ code: "data.cif.parse", severity: "error", message: `Unparseable symmetry operation "${expr}".`, source: { block: block.name } }); ok = false; return; }
            ops.push({ id: idCol >= 0 && row[idCol] ? row[idCol]! : `symop_${i}`, linear: parsed.linear, translation: parsed.translation });
        });
        if (!ok) return { ok: false, diagnostics };
        spaceOperations = ops;
    }

    // Resolve crystallography identity (crystalSystem, pointGroup, setting).
    let registryId: string | undefined;
    if (hmSymbol) registryId = HM_TABLE[normalizeHm(hmSymbol)];
    if (!registryId && hallSymbol) registryId = HM_TABLE[normalizeHm(hallSymbol)];

    // Atom-site columns (needed to determine the site representation convention).
    const siteLoop = loopFor(block, "_atom_site_label")!;
    const labelCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_label");
    const xCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_fract_x");
    const yCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_fract_y");
    const zCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_fract_z");
    const typeCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_type_symbol");
    const occCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_occupancy");
    if (xCol < 0 || yCol < 0 || zCol < 0) return fail("data.cif.missing-required", "Atom-site fractional coordinates are required.", { source: { block: block.name } });

    // Site representation convention (determined before symmetry resolution).
    // When explicit space operations or a supported identifier are supplied, the
    // sites are asymmetric-unit; any _atom_site_symmetry_multiplicity column is
    // Wyckoff metadata, not a complete-cell marker. The multiplicity column is
    // only recognized as a complete-cell marker in the absence of symmetry info.
    const multiplicityCol = siteLoop.tags.findIndex((t) => t.toLowerCase() === "_atom_site_symmetry_multiplicity");
    const hasMultiplicity = multiplicityCol >= 0;
    const hasIdentifier = Boolean(hmSymbol) || Boolean(hallSymbol) || itNumber !== undefined;
    let siteRepresentation: SiteRepresentation;
    if (hasMultiplicity && !symLoop && !hasIdentifier) {
        siteRepresentation = "complete-cell";
    } else if (!hasMultiplicity && !symLoop && !hasIdentifier) {
        return fail("data.cif.ambiguous-site-representation", "Cannot determine site representation: no symmetry description and no complete-cell marker.", { source: { block: block.name } });
    } else {
        siteRepresentation = "asymmetric-unit";
    }

    let resolvedRegistryId: string | undefined;
    let crystalSystem: CrystalSystem | undefined;
    let pointGroup: string | undefined;
    let setting: string | undefined;
    let pointOperations: readonly SpaceOperation[] | undefined;

    if (spaceOperations) {
        const validated = validateSpaceOperations(spaceOperations, lattice);
        if (!validated.ok) return { ok: false, diagnostics: validated.diagnostics.map((d) => ({ ...d, code: d.code.startsWith("core.") ? "data.cif.parse" : d.code, source: { block: block.name } })) };
        const derived = derivePointOperations(validated.value);
        const match = listPointOperationRegistryEntries().find((e) => equivalentPointOperationSets(e.operations, derived));
        if (match) {
            resolvedRegistryId = match.id;
            crystalSystem = match.crystalSystem;
            pointGroup = match.pointGroup;
            setting = match.setting;
        } else {
            crystalSystem = crystalSystemTag ? (crystalSystemTag as CrystalSystem) : classifyCrystalSystem(hmSymbol ?? "");
            diagnostics.push({ code: "data.cif.unsupported-symmetry", severity: "warning", message: "Explicit operations do not match a supported registry setting; using explicit operations directly.", source: { block: block.name } });
        }
        // Identifier consistency check.
        if (registryId && resolvedRegistryId && registryId !== resolvedRegistryId) {
            return fail("data.cif.conflicting-symmetry", `Identifier "${hmSymbol}" does not agree with the explicit operations.`, { source: { block: block.name } });
        }
        pointOperations = validated.value;
    } else if (registryId) {
        // No explicit operations, but a supported identifier resolves the crystallography.
        const entry = listPointOperationRegistryEntries().find((e) => e.id === registryId)!;
        resolvedRegistryId = entry.id;
        crystalSystem = entry.crystalSystem;
        pointGroup = entry.pointGroup;
        setting = entry.setting;
        if (siteRepresentation === "asymmetric-unit") {
            // Point operations alone are insufficient for symmetry expansion.
            return fail("data.cif.missing-operations", "A registry identifier resolves point operations only; atomic expansion requires explicit space operations.", { source: { block: block.name } });
        }
        // complete-cell: no expansion needed; crystallography resolved from the identifier.
    } else {
        // No operations and no supported registry identifier.
        if (hasIdentifier) {
            // An identifier was supplied but is not in the supported registry.
            return fail("data.cif.unsupported-symmetry", "Symmetry identifier is not in the supported registry; supply an explicit operation loop.", { source: { block: block.name } });
        }
        // No identifier at all: only valid for a complete-cell declaration with a crystal-system tag.
        crystalSystem = crystalSystemTag ? (crystalSystemTag as CrystalSystem) : undefined;
        if (!crystalSystem) return fail("data.cif.unsupported-symmetry", "Could not determine the crystal system; supply a space-group identifier or crystal-system tag.", { source: { block: block.name } });
    }

    if (!crystalSystem) {
        crystalSystem = crystalSystemTag ? (crystalSystemTag as CrystalSystem) : classifyCrystalSystem(hmSymbol ?? "");
        if (!crystalSystem) return fail("data.cif.unsupported-symmetry", "Could not determine the crystal system from the supplied symmetry.", { source: { block: block.name } });
    }

    const sites: AtomSite[] = [];
    const siteIds = new Set<string>();
    siteLoop.rows.forEach((row, i) => {
        const label = row[labelCol] ?? `site_${i}`;
        const id = label;
        if (siteIds.has(id)) diagnostics.push({ code: "data.cif.invalid-site", severity: "warning", message: `Duplicate site label "${id}"; appending an index.`, source: { block: block.name } });
        siteIds.add(`${id}.${i}`);
        const element = typeCol >= 0 && !isMissing(row[typeCol]) ? stripUncertainty(row[typeCol]!).trim() : elementFromLabel(label);
        const x = parseCifNumber(row[xCol]);
        const y = parseCifNumber(row[yCol]);
        const z = parseCifNumber(row[zCol]);
        if (x === undefined || y === undefined || z === undefined) { diagnostics.push({ code: "data.cif.missing-required", severity: "error", message: `Site "${label}" is missing fractional coordinates.`, source: { block: block.name } }); return; }
        const occupancy = occCol >= 0 ? parseCifNumber(row[occCol]) : undefined;
        const site: AtomSite = { id: `${id}.${i}`, element, position: [x, y, z] as unknown as Vec3, ...(occupancy !== undefined ? { occupancy } : {}), ...(label ? { label } : {}) };
        sites.push(site);
    });
    if (sites.length === 0) return fail("data.cif.missing-required", "No valid atomic sites found.", { source: { block: block.name } });
    const errored = diagnostics.some((d) => d.severity === "error");
    if (errored) return { ok: false, diagnostics };

    // Bonds: CIF bond import is optional in V1; report omitted bond data.
    if (BOND_TAGS.some((t) => loopFor(block, t) || scalar(block, [t]))) {
        diagnostics.push({ code: "data.cif.bonds-omitted", severity: "warning", message: "CIF bond data is present but not imported in V1; bonds are inferred from distances and labelled derived.", source: { block: block.name } });
    }

    const temperature = parseCifNumber(scalar(block, ["_cell_measurement_temperature", "_diffrn_ambient_temperature"]));
    const source: ImportSource = { format: "cif-1.1", ...(block.name ? { blockId: block.name } : {}), ...(temperature !== undefined ? { temperature } : {}), ...(lengthUnit ? { lengthUnit } : {}) };

    const crystallography: MineralCrystallography = {
        crystalSystem,
        unitCell,
        ...(pointOperations ? { spaceOperations: pointOperations } : {}),
        ...(setting ? { setting } : {}),
        ...(pointGroup ? { pointGroup } : {}),
        ...(hmSymbol ? { spaceGroup: hmSymbol } : {}),
    };

    const atomicStructure: AtomicStructure = { siteRepresentation, sites };

    const references: Reference[] = [];
    const pubTitle = scalar(block, ["_publ_section_title", "_chemical_name_systematic", "_chemical_name_mineral"]);
    if (hmSymbol || pubTitle) references.push({ id: `cif-source`, ...(pubTitle ? { title: pubTitle } : {}), notes: `Imported from CIF block "${block.name}"${hmSymbol ? `; space group ${hmSymbol}` : ""}.` });

    const provenance: ProvenanceEntry[] = [
        { coverage: ["crystallography.unitCell", "crystallography.crystalSystem", "crystallography.setting", "crystallography.pointGroup", "crystallography.spaceGroup"], status: "reported", referenceIds: ["cif-source"], derivation: "Imported from CIF 1.1 data." },
        { coverage: ["atomicStructure.sites", "atomicStructure.siteRepresentation"], status: "reported", referenceIds: ["cif-source"], derivation: "Imported from CIF 1.1 atom-site loop." },
    ];

    const frozenSpaceOperations = crystallography.spaceOperations
        ? Object.freeze([...crystallography.spaceOperations].map((op) => Object.freeze({ ...op, linear: Object.freeze([...op.linear] as unknown as Mat3) as unknown as Mat3, translation: Object.freeze([...op.translation] as unknown as Vec3) })))
        : undefined;
    const definition: StructuralDefinition = Object.freeze({
        id: block.name || "imported-structure",
        name: pubTitle || block.name || "Imported structure",
        crystallography: Object.freeze({ ...crystallography, ...(frozenSpaceOperations ? { spaceOperations: frozenSpaceOperations } : {}) }),
        atomicStructure: Object.freeze({ ...atomicStructure, sites: Object.freeze(sites) } as unknown as AtomicStructure),
        references: Object.freeze(references),
        provenance: Object.freeze(provenance),
        source: Object.freeze(source),
    });
    return { ok: true, value: definition, diagnostics };
}

function fail(code: string, message: string, extra?: Partial<Diagnostic>): Result<never> {
    const diagnostic: Diagnostic = { code, severity: "error", message, ...extra };
    return { ok: false, diagnostics: [diagnostic] };
}

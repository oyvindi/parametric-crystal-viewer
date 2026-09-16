import { createLattice, type UnitCell } from "./lattice.js";
import type { CrystalSystem } from "./miller.js";
import { generateCrystalGeometry, validateMorphology, type CrystalFormSetting } from "./morphology.js";
import type { GeometryResult } from "./geometry.js";
import type { Diagnostic } from "./diagnostics.js";
import { derivePointOperations, equivalentPointOperationSets, resolvePointOperations, validateSpaceOperations, type PointOperation, type SpaceOperation } from "./symmetry.js";

/** All descriptions refer to the supplied unit-cell basis. Registry coverage is explicit. */
export interface Crystallography {
    readonly crystalSystem: CrystalSystem;
    readonly unitCell: UnitCell;
    readonly setting?: string;
    readonly pointGroup?: string;
    readonly spaceGroup?: string;
    readonly pointOperations?: readonly PointOperation[];
    readonly spaceOperations?: readonly SpaceOperation[];
    readonly identityOnly?: boolean;
}
export interface Morphology {
    readonly forms: readonly CrystalFormSetting[];
    readonly morphologyScale?: number;
}

/** Generic, validated entry point; no mineral catalog or renderer is required. */
export function generateCrystal(crystallography: Crystallography, morphology: Morphology): GeometryResult {
    const diagnostics: Diagnostic[] = [];
    const error = (code: string, message: string, path: string) => diagnostics.push({ code, severity: "error", message, path });
    if (!["triclinic", "monoclinic", "orthorhombic", "tetragonal", "trigonal", "hexagonal", "cubic"].includes(crystallography.crystalSystem)) error("core.input.invalid-crystallography", "Unknown crystal system.", "/crystallography/crystalSystem");
    const lattice = createLattice(crystallography.unitCell);
    diagnostics.push(...lattice.diagnostics.map((d) => ({ ...d, path: `/crystallography/unitCell${d.path ?? ""}` })));
    diagnostics.push(...validateMorphology(morphology.forms, morphology.morphologyScale ?? 1));
    if (crystallography.spaceGroup && !crystallography.pointGroup && !crystallography.pointOperations && !crystallography.spaceOperations && !crystallography.identityOnly) error("core.symmetry.unsupported-registry", "Space-group registry lookup is not available; supply a supported point-group identifier or explicit operations.", "/crystallography/spaceGroup");
    let registryId: string | undefined;
    if (crystallography.pointGroup) {
        if (crystallography.pointGroup === "m-3m" && crystallography.setting === "cubic-standard" && crystallography.crystalSystem === "cubic") registryId = "point-group:m-3m:standard";
        else error("core.symmetry.unsupported-registry", "Unsupported or ambiguous point-group setting; m-3m requires cubic-standard and cubic crystal system.", "/crystallography/pointGroup");
    }
    let operations = crystallography.pointOperations;
    if (lattice.ok && crystallography.spaceOperations) {
        const space = validateSpaceOperations(crystallography.spaceOperations, lattice.value);
        diagnostics.push(...space.diagnostics);
        if (space.ok) {
            const derived = derivePointOperations(space.value);
            if (operations && !equivalentPointOperationSets(operations, derived)) error("core.symmetry.conflicting-descriptions", "Point and space operations disagree.", "/crystallography/pointOperations");
            operations ??= derived;
        }
    }
    const symmetry = lattice.ok ? resolvePointOperations({ registryId, operations, identityOnly: crystallography.identityOnly }, lattice.value) : undefined;
    if (symmetry) diagnostics.push(...symmetry.diagnostics);
    if (!lattice.ok || !symmetry?.ok || diagnostics.some((d) => d.severity === "error")) return { status: "invalid", diagnostics };
    const result = generateCrystalGeometry({ lattice: lattice.value, operations: symmetry.value, ...morphology });
    if (result.status === "invalid") return result;
    return { ...result, diagnostics: [...diagnostics, ...result.diagnostics], geometry: { ...result.geometry, faces: result.geometry.faces.map((face) => ({ ...face, ...(crystallography.pointGroup ? { symmetryGroup: crystallography.pointGroup } : {}) })) } };
}

import { createLattice, type Vec3 } from "@crystal/core";
import { projectedUp, unitDirection, validatePreferredView, MineralDataError, type MineralCrystallography, type PreferredView } from "@crystal/data";

/** Camera basis in the same crystal-local Cartesian frame as the core geometry. */
export function cameraBasis(crystallography: MineralCrystallography, preferred?: PreferredView): { direction: Vec3; up: Vec3 } {
    if (preferred) {
        const diagnostics = validatePreferredView(preferred);
        if (diagnostics.length) throw new MineralDataError(diagnostics);
    }
    const direction = unitDirection(preferred?.cameraDirection ?? [0.7, 0.5, 0.7]);
    if (preferred?.upDirection) return { direction, up: projectedUp(direction, preferred.upDirection)! };
    const lattice = createLattice(crystallography.unitCell);
    if (!lattice.ok) throw new MineralDataError(lattice.diagnostics);
    for (const column of [2, 1, 0]) {
        const axis = lattice.value.direct.map((row) => row[column]) as unknown as Vec3;
        const up = projectedUp(direction, axis);
        if (up) return { direction, up };
    }
    throw new Error("A valid lattice must supply a camera up direction.");
}

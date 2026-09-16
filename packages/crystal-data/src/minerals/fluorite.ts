import type { Mineral } from "../types.js";

/**
 * Fluorite (CaF₂) mineral record. Crystallographic data from the Materials
 * Project (publicly accessible, CC-BY 4.0). Habit development values are
 * curated visualization parameters, not measurements. See the
 * [M2 acquisition record](../../../docs/sources/m2-acquisition.md).
 *
 * Fluorite crystallizes in the cubic system, space group Fm-3m (No. 225),
 * point group m-3m. The M1 registry entry `point-group:m-3m:standard`
 * supplies the 48 point operations for this point group.
 *
 * Common forms: {100} cube, {111} octahedron, {110} rhombic dodecahedron.
 * The three shipped habits cover the principal cubic morphology transitions.
 */
export const FLUORITE: Mineral = {
    id: "fluorite",
    name: "Fluorite",
    formula: "CaF₂",
    dataRevision: "m2-1",
    crystallography: {
        crystalSystem: "cubic",
        pointGroup: "m-3m",
        setting: "cubic-standard",
        spaceGroup: "Fm-3m",
        unitCell: { a: 5.463, b: 5.463, c: 5.463, alpha: 90, beta: 90, gamma: 90 },
    },
    references: [
        {
            id: "mp-2741",
            title: "Materials Project - mp-2741: CaF2 (Cubic, Fm-3m, 225)",
            url: "https://nextgen.materialsproject.org/materials/mp-2741",
            notes: "Publicly accessible crystallographic data under CC-BY 4.0. Unit-cell parameter a = 5.463 Å.",
        },
    ],
    provenance: [
        {
            coverage: ["crystallography.unitCell", "crystallography.crystalSystem", "crystallography.pointGroup", "crystallography.spaceGroup"],
            referenceIds: ["mp-2741"],
            status: "reported",
        },
        {
            coverage: ["habits.*.forms.*.development"],
            status: "curated",
            derivation: "Development values are curated visualization parameters chosen to produce recognizable fluorite habits, not measured quantities.",
        },
    ],
    habits: [
        {
            id: "cube",
            name: "Cube",
            description: "Cube {100} dominant; the most common fluorite habit.",
            forms: [
                { id: "a", label: "Cube {100}", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 },
                { id: "o", label: "Octahedron {111}", indices: { notation: "miller", h: 1, k: 1, l: 1 }, development: 0, enabled: false },
                { id: "d", label: "Dodecahedron {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 0, enabled: false },
            ],
            references: [{ id: "mp-2741" }],
        },
        {
            id: "octahedron",
            name: "Octahedron",
            description: "Octahedron {111} dominant; common in high-temperature fluorite.",
            forms: [
                { id: "a", label: "Cube {100}", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 0, enabled: false },
                { id: "o", label: "Octahedron {111}", indices: { notation: "miller", h: 1, k: 1, l: 1 }, development: 1 },
                { id: "d", label: "Dodecahedron {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 0, enabled: false },
            ],
            references: [{ id: "mp-2741" }],
        },
        {
            id: "cubo-octahedron",
            name: "Cubo-octahedron",
            description: "Cube and octahedron co-developed; truncated-cube combination habit.",
            forms: [
                { id: "a", label: "Cube {100}", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 },
                { id: "o", label: "Octahedron {111}", indices: { notation: "miller", h: 1, k: 1, l: 1 }, development: 0.8 },
                { id: "d", label: "Dodecahedron {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 0, enabled: false },
            ],
            references: [{ id: "mp-2741" }],
        },
    ],
};

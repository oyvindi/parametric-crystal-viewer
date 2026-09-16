import type { Mineral } from "../types.js";

/**
 * Quartz (α-SiO₂) mineral record. Crystallographic data from the Materials
 * Project (mp-7000 for right-handed P3_121, mp-6930 for left-handed P3_221,
 * both CC-BY 4.0). Habit development values are curated visualization
 * parameters, not measurements. See the [M3 acquisition record](../../../docs/sources/m3-acquisition.md).
 *
 * Quartz crystallizes in the trigonal system, point group 32. The two
 * enantiomorphic variants share the same point group and unit cell but differ
 * in their space group (P3_121 No. 152 for right-handed, P3_221 No. 154 for
 * left-handed). The M3 registry entry `point-group:32:hexagonal` supplies the
 * 6 point operations for morphology.
 *
 * Common forms: prism m {10-10}, positive rhombohedron r {10-11},
 * negative rhombohedron z {01-11}. The four shipped habits cover the principal
 * quartz morphology transitions using form-level development controls.
 * Within-form asymmetry is not required for these habits and is explicitly
 * deferred per the M3 asymmetry decision.
 */
export const QUARTZ: Mineral = {
    id: "quartz",
    name: "Quartz",
    formula: "SiO₂",
    dataRevision: "m3-1",
    crystallography: {
        crystalSystem: "trigonal",
        pointGroup: "32",
        setting: "hexagonal-standard",
        spaceGroup: "P3_121",
        unitCell: { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 },
    },
    variants: [
        {
            id: "right",
            name: "Right-handed quartz",
            description: "Space group P3_121 (No. 152); the default enantiomorph.",
            crystallography: {
                crystalSystem: "trigonal",
                pointGroup: "32",
                setting: "hexagonal-standard",
                spaceGroup: "P3_121",
                unitCell: { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 },
            },
            references: [{ id: "mp-7000" }],
        },
        {
            id: "left",
            name: "Left-handed quartz",
            description: "Space group P3_221 (No. 154); the mirror enantiomorph.",
            crystallography: {
                crystalSystem: "trigonal",
                pointGroup: "32",
                setting: "hexagonal-standard",
                spaceGroup: "P3_221",
                unitCell: { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 },
            },
            references: [{ id: "mp-6930" }],
        },
    ],
    references: [
        {
            id: "mp-7000",
            title: "Materials Project - mp-7000: SiO2 (Trigonal, P3_121, 152)",
            url: "https://nextgen.materialsproject.org/materials/mp-7000",
            notes: "Publicly accessible crystallographic data under CC-BY 4.0. Unit-cell parameters a = 4.913 Å, c = 5.405 Å for right-handed α-quartz.",
        },
        {
            id: "mp-6930",
            title: "Materials Project - mp-6930: SiO2 (Trigonal, P3_221, 154)",
            url: "https://nextgen.materialsproject.org/materials/mp-6930",
            notes: "Publicly accessible crystallographic data under CC-BY 4.0. Left-handed α-quartz enantiomorph.",
        },
    ],
    provenance: [
        {
            coverage: ["crystallography.unitCell", "crystallography.crystalSystem", "crystallography.pointGroup", "crystallography.spaceGroup"],
            referenceIds: ["mp-7000", "mp-6930"],
            status: "reported",
        },
        {
            coverage: ["habits.*.forms.*.development"],
            status: "curated",
            derivation: "Development values are curated visualization parameters chosen to produce recognizable quartz habits, not measured quantities.",
        },
    ],
    habits: [
        {
            id: "prismatic",
            name: "Prismatic (Normal)",
            description: "Prism m dominant with rhombohedron r termination; the most common quartz habit.",
            forms: [
                { id: "m", label: "Prism m {10-10}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", label: "Rhombohedron r {10-11}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0.8 },
                { id: "z", label: "Rhombohedron z {01-11}", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 0.3, enabled: false },
            ],
            preferredView: { cameraDirection: [1, 0.4, 0.7] },
            references: [{ id: "mp-7000" }],
        },
        {
            id: "tessin",
            name: "Tessin",
            description: "Prism with both rhombohedra co-developed; tapered termination with z slightly dominant.",
            forms: [
                { id: "m", label: "Prism m {10-10}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", label: "Rhombohedron r {10-11}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0.7 },
                { id: "z", label: "Rhombohedron z {01-11}", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 0.9 },
            ],
            preferredView: { cameraDirection: [1, 0.4, 0.7] },
            references: [{ id: "mp-7000" }],
        },
        {
            id: "cumberland",
            name: "Cumberland",
            description: "Prism suppressed, rhombohedra r and z dominant; approaching bipyramidal habit.",
            forms: [
                { id: "m", label: "Prism m {10-10}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 0.8 },
                { id: "r", label: "Rhombohedron r {10-11}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 1 },
                { id: "z", label: "Rhombohedron z {01-11}", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 1 },
            ],
            preferredView: { cameraDirection: [0, 1, 0.5] },
            references: [{ id: "mp-7000" }],
        },
        {
            id: "pseudocubic",
            name: "Pseudocubic",
            description: "Prism absent, rhombohedra r and z equally co-developed; pseudocubic rhombohedral habit.",
            forms: [
                { id: "m", label: "Prism m {10-10}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 0.15, enabled: false },
                { id: "r", label: "Rhombohedron r {10-11}", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 1 },
                { id: "z", label: "Rhombohedron z {01-11}", indices: { notation: "miller-bravais", h: 0, k: 1, i: -1, l: 1 }, development: 1 },
            ],
            preferredView: { cameraDirection: [1, 1, 1] },
            references: [{ id: "mp-7000" }],
        },
    ],
};

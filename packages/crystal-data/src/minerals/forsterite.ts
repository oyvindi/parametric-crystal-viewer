import { defineMineral } from "../validate.js";

/**
 * Forsterite (Mg₂SiO₄) mineral record, the magnesium endmember of the olivine
 * solid solution. Crystallographic data from the Crystallography Open Database
 * (CC0). Habit development values are curated visualization parameters, not
 * measurements.
 *
 * Forsterite crystallizes in the orthorhombic system, space group Pbnm
 * (No. 62), point group mmm. The registry entry
 * `point-group:mmm:orthorhombic-standard` supplies the 8 point operations.
 * The cell retains the Pbnm axis order from the source; do not relabel as
 * Pnma.
 *
 * Common forms: pinacoids {100}, {010}, {001} and prism {110}. The two
 * shipped habits cover the principal forsterite/olivine morphology
 * transitions: tabular (flattened on {010}) and prismatic.
 */
export const FORSTERITE = defineMineral({
    id: "forsterite",
    name: "Forsterite",
    formula: "Mg₂SiO₄",
    dataRevision: "m8-2",
    crystallography: {
        crystalSystem: "orthorhombic",
        pointGroup: "mmm",
        setting: "orthorhombic-standard",
        spaceGroup: "Pbnm",
        unitCell: { a: 4.756, b: 10.207, c: 5.980, alpha: 90, beta: 90, gamma: 90 },
    },
    references: [
        {
            id: "cod-9000319",
            title: "Smyth and Hazen (1973), American Mineralogist 58, 588-593",
            url: "https://www.crystallography.net/cod/9000319.html",
            notes: "COD CC0; forsterite endmember, space group Pbnm (No. 62). Unit cell a=4.756, b=10.207, c=5.980 Å.",
        },
    ],
    provenance: [
        {
            coverage: ["crystallography"],
            referenceIds: ["cod-9000319"],
            status: "reported",
        },
        {
            coverage: ["habits"],
            status: "curated",
            derivation: "Habit form selections use standard orthorhombic form indices in the Pbnm cell basis. Development values, disabled forms, and preferred views are curated visualization choices, not measured growth parameters. The declared standard setting selects the core registry basis.",
        },
        {
            coverage: ["appearance"],
            status: "curated",
            derivation: "Appearance presets use curated visualization parameters (base color, roughness, metalness, transmission, IOR, absorption color and density) selected to represent common olivine varieties. Values are not measured optical constants.",
        },
    ],
    appearance: [
        { id: "olive", name: "Olive green", baseColor: "#6b8e23", roughness: 0.3, metalness: 0, transmission: 0.3, ior: 1.635, absorptionColor: "#4a6b18", absorptionDensity: 0.8 },
        { id: "colorless", name: "Colorless", baseColor: "#eef0f2", roughness: 0.1, metalness: 0, transmission: 0.8, ior: 1.635, absorptionColor: "#ffffff", absorptionDensity: 0 },
    ],
    habits: [
        {
            id: "tabular",
            name: "Tabular",
            description: "Pinacoid {010} dominant; flattened tabular crystal bounded by {110} and {001}.",
            forms: [
                { id: "b", label: "Pinacoid {010}", indices: { notation: "miller", h: 0, k: 1, l: 0 }, development: 1 },
                { id: "m", label: "Prism {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 0.4 },
                { id: "c", label: "Pinacoid {001}", indices: { notation: "miller", h: 0, k: 0, l: 1 }, development: 0.5 },
            ],
            references: [{ id: "cod-9000319" }],
        },
        {
            id: "prismatic",
            name: "Prismatic",
            description: "Prism {110} dominant with subordinate {010} and prism {021}; elongated prismatic habit.",
            forms: [
                { id: "b", label: "Pinacoid {010}", indices: { notation: "miller", h: 0, k: 1, l: 0 }, development: 0.5 },
                { id: "m", label: "Prism {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 1 },
                { id: "c", label: "Pinacoid {001}", indices: { notation: "miller", h: 0, k: 0, l: 1 }, development: 0, enabled: false },
                { id: "s", label: "Prism {021}", indices: { notation: "miller", h: 0, k: 2, l: 1 }, development: 0.4 },
            ],
            references: [{ id: "cod-9000319" }],
        },
    ],
});

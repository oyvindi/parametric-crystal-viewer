import { defineMineral } from "../validate.js";

/**
 * Albite (NaAlSi₃O₈) mineral record. Crystallographic data from the
 * Crystallography Open Database (CC0). Habit development values are curated
 * visualization parameters, not measurements.
 *
 * Low albite crystallizes in the triclinic system, space group C-1 (No. 2),
 * point group -1 (pinacoidal class). The registry entry
 * `point-group:-1:triclinic-standard` supplies the 2 point operations
 * (identity and inversion). Every form is a pinacoid producing two parallel
 * faces.
 *
 * Common forms: pinacoids {010}, {001}, {110}, {1-10}. The two shipped habits
 * cover the principal albite morphology transitions: tabular (flattened on
 * {010}) and prismatic (elongated blocky). Albite twinning (albite law,
 * pericline law) is common in nature but is out of scope for V1; these habits
 * represent single-crystal idealizations.
 */
export const ALBITE = defineMineral({
    id: "albite",
    name: "Albite",
    formula: "NaAlSi₃O₈",
    dataRevision: "m8-2",
    crystallography: {
        crystalSystem: "triclinic",
        pointGroup: "-1",
        setting: "triclinic-standard",
        spaceGroup: "C-1",
        unitCell: { a: 8.138, b: 12.789, c: 7.156, alpha: 94.33, beta: 116.57, gamma: 87.65 },
    },
    references: [
        {
            id: "cod-2107372",
            title: "Ribbe, Megaw, Ferguson, Taylor and Traill (1969), The albite structures, Acta Crystallographica B25, 1503-1518",
            url: "https://www.crystallography.net/cod/2107372.html",
            notes: "COD CC0; low albite, conventional C-centered cell. Space group C-1 (No. 2).",
        },
    ],
    provenance: [
        {
            coverage: ["crystallography"],
            referenceIds: ["cod-2107372"],
            status: "reported",
        },
        {
            coverage: ["habits"],
            status: "curated",
            derivation: "Habit form selections use standard pinacoidal indices in the conventional feldspar cell basis. Development values, disabled forms, and preferred views are curated visualization choices, not measured growth parameters. The declared standard setting selects the core registry basis.",
        },
        {
            coverage: ["appearance"],
            status: "curated",
            derivation: "Appearance presets use curated visualization parameters (base color, roughness, metalness, transmission, IOR, absorption color and density) selected to represent common albite varieties. Values are not measured optical constants.",
        },
    ],
    appearance: [
        { id: "white", name: "White", baseColor: "#eef0f2", roughness: 0.15, metalness: 0, transmission: 0.6, ior: 1.529, absorptionColor: "#ffffff", absorptionDensity: 0 },
    ],
    habits: [
        {
            id: "tabular",
            name: "Tabular",
            description: "Flattened parallel to {010}; pinacoid {010} dominant with {001} and {110} bounding the edges.",
            forms: [
                { id: "b", label: "Pinacoid {010}", indices: { notation: "miller", h: 0, k: 1, l: 0 }, development: 1 },
                { id: "c", label: "Pinacoid {001}", indices: { notation: "miller", h: 0, k: 0, l: 1 }, development: 0.4 },
                { id: "m", label: "Pinacoid {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 0.4 },
            ],
            references: [{ id: "cod-2107372" }],
        },
        {
            id: "prismatic",
            name: "Prismatic",
            description: "Elongated blocky habit with {110} and {1-10} prisms more developed; {010} and {001} subordinate.",
            forms: [
                { id: "b", label: "Pinacoid {010}", indices: { notation: "miller", h: 0, k: 1, l: 0 }, development: 0.7 },
                { id: "c", label: "Pinacoid {001}", indices: { notation: "miller", h: 0, k: 0, l: 1 }, development: 0.6 },
                { id: "m", label: "Pinacoid {110}", indices: { notation: "miller", h: 1, k: 1, l: 0 }, development: 1 },
                { id: "z", label: "Pinacoid {1-10}", indices: { notation: "miller", h: 1, k: -1, l: 0 }, development: 1 },
            ],
            references: [{ id: "cod-2107372" }],
        },
    ],
});

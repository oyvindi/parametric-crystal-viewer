import { defineMineral } from "../validate.js";

// Source identities and license terms: docs/sources/m5-acquisition.md.
export const PYRITE = defineMineral({
    "id": "pyrite",
    "name": "Pyrite",
    "formula": "FeS₂",
    "dataRevision": "m5-1",
    "crystallography": {
        "crystalSystem": "cubic",
        "pointGroup": "m-3",
        "setting": "cubic-standard",
        "spaceGroup": "Pa-3",
        "unitCell": {
            "a": 5.4166,
            "b": 5.4166,
            "c": 5.4166,
            "alpha": 90,
            "beta": 90,
            "gamma": 90
        }
    },
    "references": [
        {
            "id": "cod-9000594",
            "title": "Bayliss (1977), Crystal structure refinement of a weakly anisotropic pyrite: cubic model",
            "url": "https://www.crystallography.net/cod/9000594.html",
            "notes": "COD CC0; acquired 2026-09-16. See docs/sources/m5-acquisition.md for revision and checksum."
        },
        {
            "id": "pyrite-morphology",
            "title": "Arrouvel and Eon (2019), Understanding the Surfaces and Crystal Growth of Pyrite FeS2",
            "url": "https://doi.org/10.1590/1980-5373-MR-2017-1140",
            "notes": "Creative Commons Attribution; Figures 2 and 3 identify cube and pyritohedron."
        }
    ],
    "provenance": [
        {
            "coverage": [
                "crystallography"
            ],
            "referenceIds": [
                "cod-9000594"
            ],
            "status": "reported"
        },
        {
            "coverage": [
                "habits.*.forms.*.indices"
            ],
            "referenceIds": [
                "pyrite-morphology"
            ],
            "status": "reported"
        },
        {
            "coverage": [
                "habits"
            ],
            "referenceIds": [
                "pyrite-morphology"
            ],
            "status": "curated",
            "derivation": "Named idealized habit presets use documented forms. Development values, disabled forms and preferred views are curated visualization choices, not measured growth or surface-energy parameters."
        }
    ],
    "habits": [
        {
            "id": "cubic",
            "name": "Cubic",
            "description": "Six square cube faces.",
            "forms": [
                {
                    "id": "a",
                    "label": "Cube {100}",
                    "indices": {
                        "h": 1,
                        "k": 0,
                        "l": 0,
                        "notation": "miller"
                    },
                    "development": 1,
                    "enabled": true
                },
                {
                    "id": "e",
                    "label": "Pyritohedron {210}",
                    "indices": {
                        "h": 2,
                        "k": 1,
                        "l": 0,
                        "notation": "miller"
                    },
                    "development": 0,
                    "enabled": false
                }
            ],
            "references": [
                {
                    "id": "pyrite-morphology"
                }
            ],
            "preferredView": {
                "cameraDirection": [
                    1.5,
                    -2,
                    1.1
                ]
            }
        },
        {
            "id": "pyritohedral",
            "name": "Pyritohedral",
            "description": "Twelve pentagonal faces generated with pyrite point symmetry.",
            "forms": [
                {
                    "id": "a",
                    "label": "Cube {100}",
                    "indices": {
                        "h": 1,
                        "k": 0,
                        "l": 0,
                        "notation": "miller"
                    },
                    "development": 0,
                    "enabled": false
                },
                {
                    "id": "e",
                    "label": "Pyritohedron {210}",
                    "indices": {
                        "h": 2,
                        "k": 1,
                        "l": 0,
                        "notation": "miller"
                    },
                    "development": 1,
                    "enabled": true
                }
            ],
            "references": [
                {
                    "id": "pyrite-morphology"
                }
            ],
            "preferredView": {
                "cameraDirection": [
                    1.5,
                    -2,
                    1.1
                ]
            }
        }
    ]
});

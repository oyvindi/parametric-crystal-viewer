# M2 Simple Cubic Mineral Acceptance

M2 is complete. This audit covers the [delivery list and acceptance criteria](plan.md#m2--simple-cubic-mineral). The V1 checklist and later milestones remain unchanged. No owner access or scientific artifact is pending.

## Delivery and acceptance evidence

| Requirement | Implemented evidence |
|---|---|
| Fluorite mineral record | [fluorite.ts](../packages/crystal-data/src/minerals/fluorite.ts): cubic, Fm-3m (225), m-3m, a = 5.463 Å. Registered in the [catalog](../packages/crystal-data/src/catalog.ts) with stable ID `fluorite` and data revision `m2-1`. |
| Cube, octahedron, and other common forms | Three shipped habits: cube {100}, octahedron {111}, cubo-octahedron (cube + octahedron). The dodecahedron {110} form is available and exercisable through form overrides. All forms use the generic [CrystalFormSetting](../packages/crystal-data/src/types.ts) contract. |
| Form-distance transitions | [Acceptance tests](../packages/crystal-data/src/acceptance.test.ts) verify that relative development changes produce correct transitions: pure cube (6 faces), pure octahedron (8 faces), cubo-octahedron (both forms contributing), dodecahedron (12 faces), and all-three-form combinations. Increasing octahedron development transitions cube → cubo-octahedron; increasing cube development transitions octahedron → cubo-octahedron. |
| Generic core input contract | [createCrystalInput](../packages/crystal-data/src/convert.ts) converts the mineral record and morphology request into core `generateCrystal` inputs. No mineral-specific generator logic exists; the core receives generic data through `generateCrystal(crystallography, morphology)`. |
| Provenance representation | [M2 acquisition record](sources/m2-acquisition.md): reported crystallography from the Materials Project (CC-BY 4.0), curated habit development values with derivation statements. Provenance entries identify coverage, origin, status, and derivation. |
| Habits with source references | Each habit has a stable ID, name, description, and source reference. Development values are identified as curated, not measured. |
| Milestone demo | [fluorite.html](../packages/crystal-demo/fluorite.html): plain-HTML page using the exported [CrystalViewer](../packages/crystal-viewer/src/index.ts) boundary. Form-development sliders with visible numeric values, habit selector, geometry status display (valid/invalid/stale), and pointer-drag rotation. Uses generated geometry through the generic pipeline. |
| Rendering pipeline | [createThreeGeometry](../packages/crystal-three/src/index.ts) converts core Float64 geometry to a Three.js BufferGeometry with Float32 positions and deterministic triangulated indices. [CrystalViewer](../packages/crystal-viewer/src/index.ts) orchestrates loading, geometry generation, rendering, and lifecycle. |

The automated evidence is in [data tests](../packages/crystal-data/src/index.test.ts),
[acceptance tests](../packages/crystal-data/src/acceptance.test.ts),
and [renderer tests](../packages/crystal-three/src/index.test.ts). The viewer and demo
run in a browser; they use the exported viewer boundary and are not exercised by
the Node test suite.

The provisional viewer API (loadMineral, setHabit, setFormDevelopment,
getGeometryStatus, render, start/stop, resize, dispose) is subject to change
before M7 stabilization. State serialization, picking, face inspection, and
the full lifecycle and connection contracts remain explicitly scheduled for
later milestones.

## Form transition evidence

The M2 success criterion is: relative form-distance changes produce correct
transitions between common cubic morphologies. The acceptance tests verify:

| Transition | Evidence |
|---|---|
| Cube only | 6 square faces, all attributed to form `a` {100} |
| Octahedron only | 8 triangular faces, all attributed to form `o` {111} |
| Cube + octahedron co-developed | Both forms contribute visible faces; face count exceeds 8 |
| Cube → octahedron gradient | Increasing octahedron development adds octahedron faces to the cube |
| Octahedron → cube gradient | Increasing cube development adds cube faces to the octahedron |
| Dodecahedron only | 12 faces, all attributed to form `d` {110} |
| All three forms | Cube, octahedron, and dodecahedron all contribute visible faces |
| Form-order independence | Reversed form input produces identical geometry |
| All forms disabled | `core.geometry.no-active-forms` diagnostic through the data path |

## Reproduction

```sh
npm ci
npm run check
```

To run the demo:

```sh
npm run serve
# Open http://localhost:5173/packages/crystal-demo/index.html in a browser
```

ES modules cannot be loaded over the `file://` protocol; the static server is
required. The server roots at the repository root so the import map resolves
built package outputs and Three.js.

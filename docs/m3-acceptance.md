# M3 Quartz Acceptance

M3 is complete. This audit covers the [delivery list and acceptance criteria](plan.md#m3--quartz). The V1 checklist and later milestones remain unchanged. No owner access or scientific artifact is pending.

## Delivery and acceptance evidence

| Requirement | Implemented evidence |
|---|---|
| Trigonal symmetry | [trigonal-operations.ts](../packages/crystal-core/src/registry/trigonal-operations.ts): 6 point-group-32 operations generated from the same pinned spglib v2.7.0 source as M1 (Hall 441, P3_121, sg 152). Registered as `point-group:32:hexagonal` in the generalized [registry](../packages/crystal-core/src/registry.ts). |
| Miller-Bravais notation | [miller.ts](../packages/crystal-core/src/miller.ts): `millerBravaisToMiller` and `millerToMillerBravais` conversions. `transformMillerIndices` converts four-index input to three-index, transforms, and converts back. `expandEquivalentPlaneDirections` preserves Miller-Bravais notation in the result. Setting-aware validation rejects Miller-Bravais outside trigonal/hexagonal systems and validates `i = -(h + k)`. |
| Quartz forms | Prism m {10-10}, positive rhombohedron r {10-11}, negative rhombohedron z {01-11} defined in [quartz.ts](../packages/crystal-data/src/minerals/quartz.ts) using Miller-Bravais notation. All forms pass through the generic `generateCrystal` contract. |
| Basic habit presets | Four shipped habits: Prismatic, Tessin, Cumberland, Pseudocubic. Each has a stable ID, name, description, preferred view, and source reference. Development values are identified as curated. |
| Morphology sliders | The M3 quartz demo provides synchronized form-development sliders with visible numeric values, reflecting the current requested settings. |
| Face picking | [crystal-viewer](../packages/crystal-viewer/src/index.ts): raycaster-based face picking maps rendered triangles to core face indices via `createThreeGeometryWithPicking`. Emits `face-selected` events with contributor metadata including form IDs, Miller-Bravais indices, and operation IDs. |
| Face labels | `showFaceLabels` toggle renders sprite labels at face centroids showing the form ID. |
| Left/right handedness | Two `MineralVariant` entries (right: P3_121/152, left: P3_221/154) with sourced crystallography from the Materials Project (mp-7000, mp-6930). Variant selection through `setVariant`/`getVariants`/`getVariantId`. Both variants generate valid geometry through the generic contract. |
| Asymmetry decision | Resolved: the four shipped habits use only form-level development controls. Within-form asymmetry is explicitly deferred. Documented in the [M3 acquisition record](sources/m3-acquisition.md#asymmetry-decision). |
| Preferred views | Each habit defines a `preferredView` with `cameraDirection` in the crystal-local Cartesian frame. The viewer applies it during initial framing and geometry regeneration. |
| Provenance | [M3 acquisition record](sources/m3-acquisition.md): reported crystallography from the Materials Project (CC-BY 4.0) for both enantiomorphs, curated habit development values with derivation statements. |
| Quartz demo | [quartz.html](../packages/crystal-demo/quartz.html): habit selection, handedness selection, synchronized form sliders, face inspection panel showing Miller-Bravais indices, face label toggle, and geometry status display. |
| Fluorite demo retained | [fluorite.html](../packages/crystal-demo/fluorite.html) remains runnable through the updated viewer API. |

The automated evidence is in [core M3 tests](../packages/crystal-core/src/m3-acceptance.test.ts),
[data quartz tests](../packages/crystal-data/src/quartz-acceptance.test.ts),
and [registry tests](../packages/crystal-core/src/registry.test.ts). The viewer and demos
run in a browser; they use the exported viewer boundary and are not exercised by
the Node test suite.

## Success criterion evidence

The M3 success criterion is: multiple recognizable quartz habits are produced by the
same procedural engine. The acceptance tests verify:

| Habit | Faces | Forms contributing | Evidence |
|---|---|---|---|
| Prismatic (Normal) | 12 | m, r | Prism dominant with rhombohedron r termination |
| Tessin | 18 | m, M, Ψ | Prism alternating with steep rhombohedra; tapered spindle-shaped habit |
| Cumberland | 18 | m, r, z | Rhombohedra dominant, prism suppressed |
| Pseudocubic | 12 | r, z | Prism absent, rhombohedra only |

The four habits produce visibly different geometries (face counts 12/18/18/12, distinct
vertex counts and bounds).

## Miller-Bravais validation evidence

| Test | Result |
|---|---|
| Miller-Bravais to three-index conversion | (h k i l) → (h k l) by dropping i |
| Three-index to Miller-Bravais conversion | (h k l) → (h k -(h+k) l) |
| Round-trip preserves values | Four-index → three-index → four-index |
| Invalid i rejection | `i ≠ -(h+k)` produces `/i` diagnostic |
| Incompatible system rejection | Miller-Bravais with cubic system rejected |
| Symmetry transformation | C3 rotation preserves Miller-Bravais notation and `i = -(h+k)` |
| Prism expansion | {10-10} under 32 generates 6 oriented directions |
| Rhombohedron expansion | {10-11} under 32 generates 6 oriented directions |
| Notation preservation | Face contributor indices retain Miller-Bravais notation through the full pipeline |

## Handedness variant evidence

| Test | Result |
|---|---|
| Both variants generate valid geometry | Right (P3_121) and left (P3_221) both produce valid crystals |
| Point group shared | Both resolve to `point-group:32:hexagonal` (6 operations) |
| Space group distinguished | Right: P3_121, Left: P3_221 |
| Unknown variant rejection | `setVariant("nonexistent")` throws |

## Form transition evidence

| Transition | Evidence |
|---|---|
| Prism-dominant to rhombohedron-dominant | Changing development changes face count |
| Enabling z rhombohedron | Adds z faces to the prismatic habit |
| Form-order independence | Reversed form input produces identical geometry |
| All forms disabled | `core.geometry.no-active-forms` through the data path |

## Reproduction

```sh
npm ci
npm run check
node scripts/generate-m3-registry.mjs /path/to/spg_database.c --check
```

To run the demos:

```sh
npm run serve
# Open http://localhost:5173/packages/crystal-demo/index.html
```

The quartz demo is at `quartz.html`; the fluorite demo remains at `fluorite.html`.

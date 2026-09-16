# M6 CIF / Structural Data Acceptance

M6 is complete. This audit covers the [M6 criteria](plan.md#m6--cif--structural-data).
The [V1 import boundary](data-model.md#v1-import-boundary) was documented before
implementation. The success criterion is met: the viewer loads structural data
independently of morphology data.

## V1 import boundary (documented first)

The supported CIF 1.1 subset is documented in [data-model.md](data-model.md#v1-import-boundary):
supported tags, the site-representation convention, the supported registry settings,
and uncertainty/missing-value handling. Rejection cases have committed fixtures
under [`crystal-data/test-fixtures/m6/`](../packages/crystal-data/test-fixtures/m6).

## Delivery

| Capability | Evidence |
|---|---|
| CIF import | [Parser](../packages/crystal-data/src/cif.ts) and [importer](../packages/crystal-data/src/import.ts) in `crystal-data`; `importCif` returns a `StructuralDefinition` with `data.cif.*` diagnostics. |
| Unit-cell display | Unit-cell wireframe overlay in both views; [`createAtomicStructure`](../packages/crystal-three/src/atomic.ts) embeds it for atoms and the viewer builds a morphology overlay. |
| Atomic coordinates | `AtomSite` fractional coordinates normalized and preserved through expansion. |
| Symmetry expansion | [`expandAtomicStructure`](../packages/crystal-core/src/atomic.ts) applies space operations, wraps into `[0,1)`, and deduplicates by source site and metric position. |
| Periodic bond resolution | [`inferBonds`](../packages/crystal-core/src/atomic.ts) resolves bonds across the 27 neighbour cells and labels them `derived`. |
| Atomic structure rendering | [`createAtomicStructure`](../packages/crystal-three/src/atomic.ts) renders instanced atoms (CPK colours/radii), bond cylinders, the unit cell, and repeated cells. |
| View modes | `CrystalViewer.setViewMode`, `loadCif`, `loadStructure`, lattice-repetition and display toggles in the [viewer](../packages/crystal-viewer/src/index.ts). |
| Demo | [structure.html](../packages/crystal-demo/structure.html) — view-mode, unit-cell, bond, axes, and lattice-repetition controls with import diagnostics. |

Package boundaries are respected: `crystal-core` owns atomic types, expansion,
and bond inference; `crystal-data` owns CIF parsing and conversion to core inputs;
`crystal-three` owns atomic rendering; `crystal-viewer` owns view modes and
orchestration. No package gained a disallowed dependency.

## Acceptance tests

`npm test` runs 256 tests across 16 files. The 41 M6 tests are:

* [Core atomic tests](../packages/crystal-core/src/m6-acceptance.test.ts) (9): general
  expansion into the reference cell; dedup of multiple operations producing the same
  image (operation IDs retained); complete-cell not expanded twice; distinct partial
  occupancy preserved; out-of-range occupancy and non-finite positions rejected;
  expansion without operations rejected; periodic bonds across cell boundaries
  labelled derived; atoms-only view when no bonds inferred; invalid space-operation
  sets rejected before expansion.
* [Data CIF tests](../packages/crystal-data/src/m6-acceptance.test.ts) (25): uncertainty
  stripping and missing-value markers; symmetry-expression parsing; six representative
  COD fixtures import with correct crystal system, point group, setting, operation
  count, and site representation; imported structure expands and infers derived bonds;
  multi-block selection required and honoured; unknown block rejected; nanometre
  units normalized; missing required coordinate and angle diagnostics; partial
  occupancy preserved through expansion; complete-cell declaration; ambiguous site
  representation diagnostic; supported identifier + explicit operations resolve;
  unsupported identifier rejected; conflicting identifier rejected; supplied bond
  data reported as omitted (warning); CIF 2.0 rejected; provenance preservation
  (imported values reported with source references).
* [Viewer tests](../packages/crystal-viewer/src/m6-acceptance.test.ts) (7): CIF load
  switches to atomic view with structure info and import diagnostics; instanced atoms
  render and visibility toggles between modes; lattice repetition changes atom count;
  bond and unit-cell toggles; atoms-only view with no bonds and derived bonds when
  present; invalid CIF emits a failure event with diagnostics; paired trigonal-setting
  fixture displays the unit cell appropriate to each declared setting (hexagonal
  a≠c vs rhombohedral a=b=c, verified through wireframe edge lengths).

## Rejection fixtures

Fixtures for every documented rejection case live in
[`crystal-data/test-fixtures/m6/`](../packages/crystal-data/test-fixtures/m6):
`ambiguous`, `cif2`, `conflicting`, `missing-cell`, `missing-value`,
`unsupported-sym`, plus successful cases (`synthetic`, `partial-occupancy`,
`complete-cell`, `with-bonds`, `multi-block`, `nanometre`).

## Limitations and notes

* CIF bond import is optional in V1 and not implemented; supplied bond data is
  reported as omitted (`data.cif.bonds-omitted` warning) and bonds are inferred
  from distances and labelled derived. The endpoint-resolution path for imported
  bonds is therefore not exercised.
* A registry identifier alone resolves point operations for crystallography but is
  insufficient for atomic expansion (translations are required); such a CIF produces
  `data.cif.missing-operations` unless a complete-cell marker is present.
* The paired trigonal-setting fixture's hexagonal/rhombohedral geometry equivalence
  is established by the [M5 acceptance tests](m5-acceptance.md); M6 verifies the
  viewer preserves the declared setting through view-mode switches.
* `scripts/check-workspace.mjs` fails on a pre-existing `node:fs` external-import
  assertion under Node 26 (the M5 fixture reader), unrelated to M6. The TypeScript
  build, all tests, and the documentation check pass.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
```

Verification passed: 256 tests across 16 test files, the TypeScript workspace
build, documentation links/anchors/code fences, and `git diff --check`.

On 2026-09-16, headless Chrome (Google Chrome, WebGL2/SwiftShader) loaded the
[structure demo](../packages/crystal-demo/structure.html) successfully. The page
rendered all controls (view-mode, unit-cell, bonds, axes, lattice-repetition), the
minerals dropdown was populated by `listMinerals()`, the sample CIF fixtures were
fetchable, and no JavaScript console errors occurred. This is a rendering smoke
check, not the M8 appearance review. M7 (viewer API stabilization) is next.

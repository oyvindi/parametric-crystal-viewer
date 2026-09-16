# M4 Mineral Data Infrastructure Acceptance

M4 is complete. This audit covers the [M4 criteria](plan.md#m4--mineral-data-infrastructure)
and the M3 preferred-view corrections identified during implementation review.
No new external data or owner decision was needed. The V1 scope is unchanged.

## Delivery evidence

| Requirement | Evidence |
|---|---|
| Reusable schema and runtime validation | [Types](../packages/crystal-data/src/types.ts) and [validator](../packages/crystal-data/src/validate.ts) cover identity/revision, crystallography, habits, forms, variants, preferred views, references, and provenance. Malformed data returns structured diagnostics. |
| Permanent catalog organization | [Catalog](../packages/crystal-data/src/catalog.ts) provides bundled lookup, validated object loading, and isolated catalog construction with atomic duplicate rejection. [Package documentation](../packages/crystal-data/README.md) explains adding records. |
| Existing records use the permanent path | [Fluorite](../packages/crystal-data/src/minerals/fluorite.ts) and [quartz](../packages/crystal-data/src/minerals/quartz.ts) use `defineMineral`. Their revisions are `m4-1`; scientific values, form settings, and habit IDs are unchanged. Provenance coverage now explicitly includes curated form selections/settings and quartz variants. |
| Generic scientific boundary preserved | [Core crystallographic validation](../packages/crystal-core/src/crystal.ts) is reusable independently of geometry generation. The existing `generateCrystal` input contract is unchanged. Data conversion and the viewer contain no mineral-specific generators. |
| Validation and normalization | Both default and variant crystallography use core validation. Explicit nanometres become Ångström with original units retained. Unknown units, malformed operations, invalid indices/development, invalid preferred views, unresolved references, and missing provenance coverage are rejected. |
| Safe ownership | Valid records are detached, deeply frozen snapshots; caller edits cannot mutate the catalog or loaded definition. |
| Viewer loading | The exported [viewer](../packages/crystal-viewer/src/index.ts) accepts a bundled ID or provisional record. Failed loads emit diagnostics and preserve the configuration, mesh, and camera. Valid records with invalid morphology commit and show the geometry diagnostic without the previous definition's mesh. |
| Provisional-record acceptance | [M4 tests](../packages/crystal-data/src/m4-acceptance.test.ts) load a synthetic explicit-identity, six-plane record through an isolated catalog and generate geometry using unchanged generic core code. This test fixture does not count toward M5 mineral or crystal-system coverage. |

Validation establishes metadata integrity, not scientific source sufficiency. The
existing [M2](sources/m2-acquisition.md) and [M3](sources/m3-acquisition.md) acquisition
records remain the source history; M4 does not claim a fresh scientific-source audit.

## M3 preferred-view correction

The previous implementation reapplied preferred views on every geometry update and
ignored up-vector metadata. It now preserves the camera and user rotation during
habit, form, and variant edits. Initial valid geometry and explicit `resetCamera`
apply the current habit's view, with a projected explicit up vector or deterministic
fallback through the actual lattice c, b, and a vectors. Reset also removes the
viewer's display rotation so the preferred direction is in crystal-local coordinates.

Zero, non-finite, malformed, and parallel vectors are rejected before a record
commits. The new [camera tests](../packages/crystal-viewer/src/camera.test.ts) include
non-orthogonal lattice-up behavior, and [viewer tests](../packages/crystal-viewer/src/index.test.ts)
verify camera preservation and reset through public operations. Camera-state
restoration remains an M7 acceptance check; no serialization is claimed here.

Both existing demos now expose a reset-camera button.

## Verification

Run the workspace checks and documentation check:

```sh
npm run check
node scripts/check-docs.mjs
```

Verification passed: 155 tests across 11 test files, the TypeScript workspace build, package dependency checks, documentation links/anchors/code fences, and `git diff --check`. The suite includes core, data, renderer, and viewer tests. Viewer Node tests retain
real Three.js cameras, scenes, and geometry while stubbing the WebGL renderer;
they do not substitute for browser rendering checks.

On 2026-09-16, headless Chrome with WebGL2/SwiftShader loaded both demos successfully.
Browser interaction checks exercised all three fluorite and four quartz habits,
form sliders and numeric readouts, left-handed quartz selection, and camera reset.
All habits displayed valid status, and no browser exceptions occurred. Screenshots
were inspected for visible geometry in both demos; machine-local captures are not
committed. This is a rendering smoke check, not the M8 appearance review.

M5 is next: acquire the remaining mineral/fixture sources, add calcite, pyrite and
anatase with their habits, and validate the remaining systems and paired trigonal
settings under the [coverage matrix](plan.md#mineral-and-crystal-system-coverage).

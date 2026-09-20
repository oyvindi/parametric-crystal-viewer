# SR10 Procedural Display Growth Morphology Acceptance

**Status:** accepted on 2026-09-20, including the boolean-union and edge/corner
growth composition. The optional display-only fluorite preset now renders a single
closed watertight display surface.

## Delivered scope

The viewer defaults to the idealized scientific core mesh. Fluorite alone can select
the optional `terraced-fluorite` display-growth mode, labelled **Terraced fluorite**,
with an optional unsigned 32-bit seed for deterministic variation. The preset creates
a curated, typical field of stepped cubic child-growth components on cube-form `a` /
`{100}` faces, composes them with shallow edge/corner growth blocks via a
dependency-free boolean union, and renders a single closed watertight display
component. It is not a specimen reconstruction or a measurement.

The display geometry is constructed in `crystal-three` from renderer-neutral data and
converted to GPU buffers only at the rendering boundary. The core mesh, scientific
bounds, normals, contributors, inspection result, and default export remain unchanged.
The single display component is closed and watertight; each triangle attributes to an
originating core face; display picking exposes only that core face. Existing reviewed
face-local surface profiles do not route onto display geometry. GPU conversion centers
Float64 positions before casting to Float32 to preserve thin-triangle separations at
small morphology scales.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. The full
suite contains 524 tests.

Focused SR10 tests verify byte-identical geometry and attribution for the same seed,
changed geometry for a different seed, watertight components, child-footprint bounds,
core-face attribution, state serialization, unavailable-mode rejection on non-fluorite,
GPU resource replacement/disposal when mode or seed changes, mineral replacement
disposal, and rejection-before-disposal in the viewer's update path. The viewer test
also confirms that display-mode replacement does not change the retained scientific core.

## Visual regression and owner review

`npm run baseline:sr10` captures the pinned fluorite scene and writes the committed
[SR10 baseline manifest](baselines/sr10/manifest.json) and
[PNG](baselines/sr10/fluorite-terraced.png). The workflow fixes cube habit, seed
`0x5f3759df`, 960×720 output at device scale factor 1, project-owned studio
environment, AgX tone mapping, exposure `1`, disabled surface detail, and records the
resolved camera, browser, and platform.

Owner visual review accepted coherent stepped cubic growth, bounded child footprints,
deterministic variation, core-face-only inspection, and preservation of the idealized
comparison mesh. An initial union-only comparison showed pronounced corners at cube
edges; the owner then authorized and approved the shallow edge/corner growth treatment,
which staggers discrete blocks along edges and at corners to interrupt the straight
seam without creating a frame.

## Verification

```sh
npm run check
npm run baseline:sr10
node scripts/check-docs.mjs
git diff --check
```

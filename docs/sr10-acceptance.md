# SR10 Procedural Display Growth Morphology Acceptance

**Status:** first Terraced fluorite slice accepted on 2026-09-20. This records the
optional display-only fluorite preset; it does not accept the deferred
boolean-composed display-surface follow-up.

## Delivered scope

The viewer defaults to the idealized scientific core mesh. Fluorite alone can select
the optional `terraced-fluorite` display-growth mode, labelled **Terraced fluorite**,
with an optional unsigned 32-bit seed for deterministic variation. The preset creates
a curated, typical field of stepped cubic child-growth components on cube-form `a` /
`{100}` faces. It is not a specimen reconstruction or a measurement.

The display geometry is constructed in `crystal-three` from renderer-neutral data and
converted to GPU buffers only at the rendering boundary. The core mesh, scientific
bounds, normals, contributors, inspection result, and default export remain unchanged.
Each display component is closed and watertight; each triangle attributes to an
originating core face; display picking exposes only that core face. Existing reviewed
face-local surface profiles do not route onto display geometry.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. The full
suite contains 511 tests.

Focused SR10 tests verify byte-identical geometry and attribution for the same seed,
changed geometry for a different seed, watertight components, child-footprint bounds,
core-face attribution, state serialization, unavailable-mode rejection on non-fluorite,
and GPU resource replacement/disposal when mode or seed changes. The viewer test also
confirms that display-mode replacement does not change the retained scientific core.

## Visual regression and owner review

`npm run baseline:sr10` captures the pinned fluorite scene and writes the committed
[SR10 baseline manifest](baselines/sr10/manifest.json) and
[PNG](baselines/sr10/fluorite-terraced.png). The workflow fixes cube habit, seed
`0x5f3759df`, 960×720 output at device scale factor 1, project-owned studio
environment, AgX tone mapping, exposure `1`, disabled surface detail, and records the
resolved camera, browser, and platform.

Owner visual review accepted coherent stepped cubic growth, bounded child footprints,
deterministic variation, core-face-only inspection, and preservation of the idealized
comparison mesh. The physical boundary between independently closed face-local child
fields remains visible at some cube edges. An attempted shared-edge bridge was rejected
because it created a conspicuous bevel/frame; the existing bounded face-local result is
accepted for this slice.

## Deferred follow-up

A possible renderer-neutral boolean-composed display surface is deferred as specified
in [SR10](surface-rendering-plan.md#deferred-follow-up--boolean-composed-display-surface)
and [ADR 0014](decisions/0014-procedural-display-growth-morphology.md). It requires a
separate reviewed design for deterministic CSG, watertight output, generated-triangle
core-face provenance, and any edge-spanning geometry. It does not change the accepted
first-slice constraints.

## Verification

```sh
npm run check
npm run baseline:sr10
node scripts/check-docs.mjs
git diff --check
```

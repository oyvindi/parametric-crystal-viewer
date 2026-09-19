# SR0 Surface Rendering Baseline Acceptance

SR0 is complete. This audit covers the evidence and reference-scene gate in the
[surface rendering plan](surface-rendering-plan.md#sr0--evidence-and-reference-scene-baseline).
It changes neither scientific geometry nor renderer behavior.

## Evidence gate

The reviewed records and stable references for quartz prism striations, calcite basal
luster, calcite cleavage luster, and pyrite cube striations live in the
[surface acquisition record](sources/surface-rendering-acquisition.md#source-decisions-by-delivery-case).
They distinguish growth faces from cleavage and state when a claim is typical rather
than universal. Quartz `{10−10}`, calcite `{0001}`, and pyrite `{100}`/`{210}` notation
was checked visually against the cited pages because PDF text extraction loses
overbars and mathematical symbols.

Calcite's accepted basal claim is deliberately inactive: neither current calcite
habit contains `{0001}`. The cleavage claim is renderer-ineligible. Pyrite's later
direction rule must use oriented cube/pyritohedron intersection edges, not world axes.

## Appearance inventory

All existing numeric parameters are curated renderer inputs rather than measured
optical constants. The corresponding mineral records carry `appearance` provenance
with `status: curated`; absence means the renderer defaults are used.

| Mineral | Current appearance presets | Provenance |
|---|---|---|
| Albite | `white` | curated |
| Anatase | none | renderer defaults |
| Beryl | `emerald`, `aquamarine`, `goshenite` | curated |
| Calcite | none | renderer defaults |
| Fluorite | `violet`, `green`, `colorless` | curated |
| Forsterite | `olive`, `colorless` | curated |
| Gypsum | `colorless`, `selenite` | curated |
| Pyrite | `brass`, `tarnished` | curated |
| Quartz | `rock-crystal`, `amethyst`, `smoky`, `citrine`, `rose` | curated |

## Reproducible reference scenes

[`surface-baseline.html`](../packages/crystal-demo/surface-baseline.html) is the single
comparison scene. It fixes a 960 × 720 CSS-pixel viewport, preferred-view camera
framing, first habit and appearance preset, the project-owned procedural studio
environment, intensity `1`, zero environment rotation, background zoom `1`, AgX tone
mapping, and exposure `1`.

Run:

```sh
npm run baseline:sr0
```

The command builds the workspace, captures all nine PNGs into
`docs/baselines/sr0/`, and writes `manifest.json` with exact scene choices, frame-time
method, browser, Node version, OS/architecture, and results. The procedural environment
is original project code and has no external asset or redistribution dependency.
Frame timings use a fixed one-second `requestAnimationFrame` sampling window after one
warm-up frame; compare them only on the same recorded hardware/browser setup. The current acceptance hardware is
the machine recorded in the committed manifest, using Chrome's headless SwiftShader
path for reproducibility.

The capture path does not enable labels, picking, highlights, or geometry controls,
and invokes only presentation and camera APIs after mineral load. Scientific geometry
and picking code are unchanged by SR0.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
npm run baseline:sr0
```

Acceptance requires nine PNG files, nine manifest scene entries, valid geometry in
the source demo, and successful workspace/document checks. Browser GPU and driver
updates can change pixels; the manifest pins the captured renderer environment and
the images are comparison evidence rather than scientific fixtures.

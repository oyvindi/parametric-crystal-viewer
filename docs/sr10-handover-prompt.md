# SR10 Handover Prompt

Continue implementation of SR10 — Procedural Display Growth Morphologies — in the
crystal viewer repository.

Start by reading `AGENTS.md`, `docs/spec.md`, `docs/scientific-model.md`,
`docs/data-model.md`, `docs/architecture.md`, `docs/viewer-api.md`,
`docs/surface-rendering-plan.md`, and ADR 0014. The surface-rendering plan is the
task-specific sequence; the owning contracts remain authoritative.

## Confirmed Product Decision

Literal growth terraces and dissolution etching require a separately generated,
display-only render mesh. Normal/roughness shading is not an acceptable substitute for
visible pits, channels, negative-crystal cavities, recessed faces, or stepped depth.
It lacks parallax, self-occlusion, cavity rims, and real depth.

SR9's fluorite `{100}` shader-only `growth-steps` profile was implemented under an
earlier interpretation. It is superseded and must be removed as part of the first SR10
slice; do not run it alongside the display mesh or ask for SR9 visual approval.

## First Deliverable

Implement optional **Terraced fluorite** display-growth mode for fluorite cube form
`a` / `{100}`. The display mesh should show recessed, nested square hopper terraces.
It is a curated typical interpretation of the reviewed natural-growth observation, not
a reconstruction or measurement of a specimen.

## Non-Negotiable Constraints

* The idealized core mesh remains the authoritative scientific geometry.
* Default rendering, scientific bounds, normals, contributors, face inspection,
  picking result, and default exports remain core-only and unchanged.
* Generate a separate render mesh; every solid component must be closed and watertight.
* Every display triangle maps to an originating core face. A display hit exposes that
  core face only; do not invent a public display-feature identity.
* The display mesh must be deterministic from state and have deterministic replacement
  and disposal behavior.
* Do not apply existing face-local `surfaceProfiles` to display geometry without an
  explicit reviewed mapping. Remove the legacy fluorite shader profile instead.
* Keep crystal calculations and display-mesh generation independent of Three.js and
  browser APIs. Three.js only converts the derived geometry for rendering.
* Keep visible literal etching for later SR10 evidence-gated slices. Current fluorite
  `{100}` / `{111}` etch-pit and quartz `z {01-11}` etching records are candidates,
  not authorization for rendering.

## Suggested Implementation Order

1. Design renderer-neutral display-geometry types, core-face attribution, and
   watertightness validation. Record a decision if alternatives have material tradeoffs.
2. Define explicit viewer state/API and serialization behavior for display-growth mode;
   default must be idealized mode.
3. Generate deterministic fluorite cube-face hopper terraces, test watertightness and
   triangle attribution, then convert it in `crystal-three`.
4. Preserve picking to the source core face and implement resource disposal/replacement.
5. Add a focused demo, automated regression baseline, and owner visual-review checklist.

## Current Evidence and Documents

* `docs/sources/surface-rendering-acquisition.md` — sources, scope, and rights.
* `docs/sr8-acceptance.md` — complete descriptive-claim catalogue.
* `docs/sr9-acceptance.md` — superseded shader cue; historical baseline only.
* `docs/baselines/sr9/` — historical pinned capture set; do not treat it as acceptance
  for the display mesh.

Run `npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` before each
handoff. Ask the owner for visual feedback only when the Terraced fluorite display mesh
is available in a focused demo with fixed review settings.

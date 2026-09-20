# SR10 Handover Prompt — Deferred Boolean-Composition Design Spike

Continue the deferred SR10 investigation — **Boolean-Composed Display Surface** — in
the crystal viewer repository.

Use **GPT-6 Astra** with **high** reasoning effort. This is a geometry/topology design
spike, not authorization to expand SR10’s accepted implementation without evidence and
owner review.

Start by reading:

* `AGENTS.md`
* `docs/spec.md`
* `docs/scientific-model.md`
* `docs/data-model.md`
* `docs/architecture.md`
* `docs/viewer-api.md`
* `docs/surface-rendering-plan.md`
* `docs/decisions/0014-procedural-display-growth-morphology.md`
* `docs/sr10-acceptance.md`
* `docs/sr10-baseline.md`

The owning contracts remain authoritative.

## Current SR10 state

The accepted first Terraced fluorite slice is committed as:

```text
78f4bd1 Add terraced fluorite display growth
d8b583e Add SR10 visual regression acceptance
91432cf Document deferred SR10 CSG evaluation
```

The current accepted preset:

* retains the idealized core mesh as scientific authority;
* defaults to `displayGrowth: "idealized"` and supports optional
  `"terraced-fluorite"` plus an unsigned-32-bit `displayGrowthSeed`;
* creates separate, closed, watertight cubic child-growth display components on
  fluorite cube-form `a` / `{100}` faces;
* maps every display triangle to a core face and exposes no display-feature identity
  through picking;
* keeps child footprints within their source core faces; and
* has an accepted pinned visual baseline at
  `docs/baselines/sr10/fluorite-terraced.png`.

The owner accepted the coherent stepped cubic growth direction, seeded variation,
core-face-only inspection, and idealized-core comparison. A physical seam remains
visible at some cube edges because face-local closed child components meet at 90°.
An attempted shallow shared-edge bridge created an obvious bevel/frame and was rejected.
Do not resurrect that approach.

## Deferred question

Assess whether a **renderer-neutral boolean union** of the idealized-core solid and
display-growth solids can remove overlapping internal display surfaces—especially for
transmission—and produce a cleaner external display surface. A union limited to current
face-local solids cannot by itself soften a physical cube edge. Any edge-spanning
operand is a separate, blocking design question; do not infer permission for child
footprints to cross a source-face boundary.

Start with a dependency-free constrained design for fluorite’s convex cube core and
cubic child growth. Do not add a general CSG dependency unless a separate review first
addresses determinism, watertightness, generated-triangle provenance, runtime/WASM and
bundle cost, licensing, and package-boundary compatibility. Renderer-level CSG helpers
are not suitable by default because they do not preserve required core-face attribution.

## Non-negotiable constraints

* Do not alter scientific core geometry, bounds, normals, contributors, inspection,
  default exports, or default picking.
* Keep display generation independent of Three.js and browser APIs; Three.js only
  converts derived geometry to GPU buffers.
* Every resulting solid display component must be closed and watertight.
* Every generated display triangle must map to an originating core face; expose no
  public display-feature ID.
* Preserve deterministic regeneration, replacement, disposal, and pinned-baseline
  behavior.
* Existing `surfaceProfiles` must not apply to display geometry without an explicit,
  reviewed mapping.
* Literal dissolution/etch pits remain deferred and evidence-gated.
* Do not commit, redistribute, or elevate the user-supplied fluorite image to mineral
  data or evidence.

## Suggested work

1. Write an implementation-design note before changing production geometry. Define the
   supported input class, output representation, face-provenance propagation, numerical
   tolerances, component semantics, and rejection diagnostics.
2. Make a small renderer-neutral prototype only if it can demonstrate deterministic,
   watertight output for the constrained fluorite case and retain core-face attribution
   after every split/intersection.
3. Compare prototype output against the accepted SR10 baseline, especially through
   fluorite transmission. Do not replace the accepted display preset without owner
   visual review.
4. Add tests for topology, deterministic byte identity, provenance, core immutability,
   and resource lifecycle in proportion to any prototype that is retained.
5. Record whether the spike supports a dependency-free path, needs an evaluated CSG
   dependency, or should remain deferred. Update the deferred plan/ADR only with that
   evidence; do not mark the follow-up accepted without owner review.

Run before handoff:

```sh
npm run check
node scripts/check-docs.mjs
git diff --check
```

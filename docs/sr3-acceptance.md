# SR3 Face-Local Material Infrastructure Acceptance

SR3 is complete. `crystal-three` now derives deterministic surface selectors and local
tangent coordinates from immutable core faces, and the viewer uses that face-local
render buffer for morphology meshes. No SR4 procedural variation or edge response and
no SR5 mineral-specific profile has been added.

## Decisions

The durable design is recorded in
[ADR 0006](decisions/0006-face-local-surface-encoding.md):

* selectors can combine form ID, normalized Miller family, and oriented Miller indices;
* tied contributors resolve by priority, specificity, rule ID, then contributor ID;
* profile zero is the explicit fallback for unmatched and imported measured faces;
* tangents use projected crystal-local reference directions with a deterministic
  least-aligned-axis fallback;
* polygon faces expand into render-only triangle vertices carrying profile, tangent,
  and centered local-coordinate attributes; and
* one material strategy is retained, with a diagnostic shader used to prove profile
  routing before actual SR4/SR5 effects exist.

The four vertex attribute locations used by this path (position plus the three SR3
attributes) fit below the WebGL 2 minimum of sixteen. Profile IDs are capped at 65,535,
well within exact `Float32` integer representation. No per-face texture or material is
therefore required for the supported current catalog face counts.

## Behavioral evidence

The SR3 tests cover deterministic tied-contributor precedence; family versus oriented
selection; tangent construction for cubic, trigonal/hexagonal-setting, monoclinic, and
triclinic examples; the parallel-reference fallback; per-polygon attribute consistency;
profile validation; imported-face fallback; scientific-buffer immutability; and complete
triangle-to-core-face contributor recovery.

Changing rules on an existing render buffer retains its position attribute, index,
buffer identity, and picking order while replacing only the face-local attributes. The
existing viewer suite exercises morphology changes, highlighting, picking, appearance,
and state restoration against the integrated buffer path. Face selection remains
transient under the existing serialization contract, while all persistent viewer state
continues to round-trip without a schema change.

The fixed [SR3 scenes](baselines/sr3/manifest.json) cover all nine catalog minerals with
the same camera, environment, presentation, and output dimensions as SR2. Every SR3 PNG
is byte-for-byte identical to its corresponding SR2 image, confirming that the render
buffer expansion and unused face-local attributes change neither silhouettes nor current
material output. The manifest also records the browser-dependent frame samples; these
remain supporting observations rather than a portable performance threshold.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
node scripts/capture-surface-baseline.mjs sr3
git diff --check
```

Acceptance requires all workspace tests and builds, documentation links, Markdown
structure, package-boundary checks, and whitespace checks to pass.

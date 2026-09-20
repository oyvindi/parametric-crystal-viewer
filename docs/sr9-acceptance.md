# SR9 Face-Local Growth-Step Cue Acceptance

**Status:** superseded on 2026-09-20; no owner visual review is required. SR9 added the
fluorite `{100}` shader-only growth-step cue under an earlier interpretation. The owner
determined that literal terraces and etching require their own mesh, so SR10 supersedes
this milestone. The legacy profile is pending removal as part of SR10; this audit is
historical automated evidence, not a request for sign-off.

## Scope and evidence

The active `fluorite.100-growth-steps` profile promotes the reviewed
`surface.fluorite.100-growth-steps` claim and selects only cube form `a` / `{100}`.
The source describes natural growth layers, while spacing, height, density, phase, and
irregularity remain curated renderer values. The cue is typical, not a reconstruction
or measurement of the displayed specimen.

Natural fluorite `{100}` and `{111}` dissolution-pit observations and the
locality-specific quartz `z {01-11}` etching observation are retained as separate,
inactive descriptive candidates. They cannot route faces or change materials. Their
literal realization requires SR10 geometry.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. The full
suite contains 508 tests. Existing numeric tests verify that the fluorite profile maps
only to cube faces and leaves other face classes on fallback profile zero. Viewer tests
verify a positive fluorite match count while the data tests distinguish growth-layer
and dissolution-pit claims.

`npm run baseline:sr9` captures all nine minerals with the project-owned studio
environment, AgX tone mapping, exposure `1`, and surface detail strength `0.35`.
The committed [SR9 baseline manifest](baselines/sr9/manifest.json) records browser,
platform, framing, appearance selection, and frame timing. The command uses no remote
runtime asset. These captures are deterministic regression evidence; they do not
replace the focused owner visual review below.

## Supersession

Shading can represent fine, bounded reflection or roughness variation, but it cannot
provide the parallax, self-occlusion, cavity rims, stepped depth, or negative-crystal
forms required for literal terracing and etching. SR10 therefore owns the required
display-only procedural mesh. It must preserve the idealized core mesh, scientific
exports, bounds, normals, contributors, and inspection identity while rendering a
separate attributed display mesh.

## Verification

```sh
npm run check
npm run baseline:sr9
node scripts/check-docs.mjs
git diff --check
```

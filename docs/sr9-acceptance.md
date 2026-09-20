# SR9 Face-Local Growth-Step Cue Acceptance

**Status:** automated gates pass; owner visual review is pending. SR9 adds only the
reviewed fluorite `{100}` growth-step cue. It does not implement literal etching:
etch pits, negative-crystal cavities, channels, and other geometric dissolution forms
are deferred to the SR10 display-mesh layer.

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

## Owner visual review

Start the demo server with `npm run serve`, then open:

`http://127.0.0.1:5173/packages/crystal-demo/surface-overview.html?mineral=fluorite`

With **Surface detail** enabled at strength `0.35`, rotate the fluorite and compare the
two panels. Confirm that:

* the enabled panel shows restrained, face-local growth-layer shading on cube `{100}`
  faces only;
* the cue stays locked to the crystal during rotation, with no seams or camera-space
  swimming;
* it reads as a shallow typical growth cue, not as actual recessed etching or a
  measurement of this specimen; and
* the silhouette, face edges, and face inspection/picking remain unchanged from the
  detail-off panel.

Report confirmation or the requested visual adjustment here before marking SR9
complete. No image upload is needed unless a specific defect needs diagnosis.

## Verification

```sh
npm run check
npm run baseline:sr9
node scripts/check-docs.mjs
git diff --check
```

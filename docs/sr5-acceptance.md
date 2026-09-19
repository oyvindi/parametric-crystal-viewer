# SR5 Reviewed Form-Specific Profiles Acceptance

**Status:** complete. Automated gates and owner visual review passed 2026-09-19.

SR5 adds only the three reviewed profiles in the prescribed order. The record and
renderer mapping are separated by [ADR 0008](decisions/0008-reviewed-surface-profiles.md).
No SR6 transmission or optical refinement is included.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. Numeric
tests verify that quartz selects prism `m` faces and uses c as its crystal-local
across-striae coordinate; pyrite selects only cube-form faces and produces perpendicular
edge-derived directions on adjoining faces; and unknown profiles have no renderer rule.
Record tests verify reported provenance and exclude calcite's cleavage-only claim.
Viewer tests report matched quartz and pyrite profiles and a zero match count for
calcite, because the current shipped calcite habits have no `{0001}` growth face.

Scientific vertices, face normals, bounds, contributor provenance, picking, and the
single-material rendering path remain unchanged. Profile values in the shader are
curated visualization constants, not reported frequencies or amplitudes.

## Owner visual review

Start the demo server with `npm run serve`, then review these fixed URLs without changing
the selected mineral:

* `http://127.0.0.1:5173/packages/crystal-demo/surface-profiles.html?mineral=quartz`
  — rotate freely. Verify striations occur on prism faces only, run perpendicular to
  c, remain locked to the crystal under rotation, and do not appear on rhombohedra.
* `http://127.0.0.1:5173/packages/crystal-demo/surface-profiles.html?mineral=calcite`
  — verify the panel identifies the documented `{0001}` growth-face profile but says no
  shipped face matches; no pearly treatment should be inferred from cleavage evidence.
* `http://127.0.0.1:5173/packages/crystal-demo/surface-profiles.html?mineral=pyrite`
  — rotate freely. Verify detail is confined to cube faces, follows edge-relative
  directions, and the visual direction changes per adjacent face rather than following
  a world or camera axis.

Record confirmation or requested changes here before marking SR5 complete. No image
inspection is required unless an automated failure or visual defect needs diagnosis.

## Owner confirmation

The owner confirmed all three review cases. Quartz striations were visible only on prism
faces, remained crystal-local under rotation, and did not transfer to end faces. Calcite
correctly reported its reviewed basal profile with no matching shipped growth face. Pyrite
striations remained on cube faces and followed face-relative, changing directions on
adjacent faces. No silhouette change, cross-face pattern, or unwanted profile was
reported.

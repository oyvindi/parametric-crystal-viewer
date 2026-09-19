# SR4 Generic Microvariation and Edge Response Acceptance

SR4 is complete. The renderer now provides optional generic, deterministic surface
naturalization without adding mineral-specific profiles or changing scientific
geometry. The durable shader, seed, edge, and state choices are recorded in
[ADR 0007](decisions/0007-generic-surface-microvariation.md).

## Delivery and boundaries

The existing single physical material receives low-amplitude analytic normal and
roughness variation in face-local object coordinates. A restrained grazing-angle
contribution improves edge response without bevel geometry or displacement. Strength
is bounded to `[0, 1]`; detail defaults off. This is curated artistic rendering and is
not described as an observed mineral feature.

Each polygon face carries one stable exact `Float32` seed derived from mineral, habit,
appearance, core-face index, and sorted contributor identity. All triangles within the
face use the same seed and coordinate frame. Time, camera, model transform, and triangle
identity do not enter the procedural function.

The optional `surfaceDetail` state member stores enabled and strength values. Older
version-1 states restore off through the V1-to-V2 migration. Invalid settings reject
transactionally. Material,
geometry, and per-face seed resources are replaced or disposed through the existing
mesh lifecycle.

## Acceptance evidence

Automated tests verify stable hashing, exact seed range, polygon-level seed sharing,
continuous coordinates at duplicated triangle vertices, shader inputs, strength
validation, enabled-state round trips, legacy-state behavior, transactional rejection,
and byte-for-byte preservation of core vertices, faces, bounds, and contributors.
Existing suites continue to cover picking, highlighting, morphology, replacement,
disposal, opaque, metallic, and transmissive paths.

Selection highlighting uses a depth-safe translucent front-face tint. Tests verify that
selection leaves camera state unchanged and does not replace transmissive depth cues
with an opaque double-sided overlay.

The fixed [SR4 scenes](baselines/sr4/manifest.json) cover all nine catalog minerals
under the pinned SR0 comparison presentation. They enable generic detail at strength
`0.35`; the manifest records the setting and browser-dependent timing samples. A
separate disabled comparison confirms the SR4 render path preserves every SR3 PNG
byte-for-byte when strength is zero. Headless SwiftShader timings are supporting
regression observations, not a portable interactive-GPU threshold.

The [interactive comparison demo](../packages/crystal-demo/surface-detail.html) places
the disabled and enabled render paths side by side. Mineral selection, reset view, and
pointer rotation remain synchronized, while a bounded strength control updates only the
enabled side.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
npm run baseline:sr4
git diff --check
```

Acceptance requires all workspace tests and builds, documentation links, nine visual
scenes, deterministic repeat capture, disabled-output comparison, and scientific
geometry checks to pass.

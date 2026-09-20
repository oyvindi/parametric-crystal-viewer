# SR7 Public API, Demo, and Acceptance Audit

**Status:** automated gates pass. The human visual review package below is ready for
owner sign-off; this audit does not substitute automated checks for human visual judgment.
One generic-microvariation appearance item is deferred for later review (see below).

This is the historical SR7 acceptance record. SR9 subsequently added the fluorite
`{100}` growth-step profile; SR7's three-profile inventory, demo instructions, and
test counts below describe the SR7 baseline and are not the current SR9 acceptance
evidence.

SR7 closes the surface-rendering track. It adds a comprehensive demo, confirms the stable
public API, records the state-migration decision, adds `prefers-reduced-motion` handling,
and collects the cross-cutting acceptance evidence. No scientific geometry, mineral data,
surface profile, or shader constant changed. The state and reduced-motion decisions are
recorded in [ADR 0010](decisions/0010-sr7-surface-state-and-reduced-motion.md).

## State migration decision

`surfaceDetail` needs no additional migration of its own. The member (`{ enabled,
strength }`) is already the complete serialized surface state: the only stable controls
are enable/disable and overall strength, both serialized in SR4. `STATE_VERSION` is now
`2` because orthographic projection added a separate V2 camera migration; version-1
states remain accepted and are normalized to V2 on restore.
Effective surface profile information is derived from the selected mineral and current
generated faces and is deliberately not serialized
([viewer API](viewer-api.md#generic-surface-detail)); serializing it would duplicate data
already referenced by the mineral identity and create a stale-serialization hazard. Legacy
Version-1 states written before SR4 omit `surfaceDetail` and restore with detail off, as
already documented and tested. SR7 neither adds, renames, nor removes a serialized surface
field. See [ADR 0012](decisions/0012-orthographic-projection.md) for the V1-to-V2 camera
migration.

## Public API surface

The viewer exposes only stable surface controls. Numeric tests assert the shape:

* `getSurfaceDetail()` returns exactly `{ enabled, strength }`.
* `getSurfaceProfiles()` returns exactly `{ id, kind, claimId, description, matchedFaceCount }`
  per profile. No seed, frequency, amplitude, phase, spacing, wavelength, or shader uniform
  key is present — implementation constants are never exposed as scientific measurements.
* `setSurfaceDetail(enabled, strength)` rejects non-boolean enable and strength outside
  `[0, 1]` without changing state.

Profiles resolve from the selected mineral and current generated faces; a match indicates
an eligible documented-typical rendering treatment, not a measurement of the displayed
specimen. Every reviewed profile description carries "not specimen-measured".

## SR7 demo

[`surface-overview.html`](../packages/crystal-demo/surface-overview.html) is the
comprehensive surface-rendering demo. It covers all nine current minerals with the stable
controls only — a surface-detail enable checkbox and a `[0, 1]` strength slider — plus an
effective-profile panel that reports `getSurfaceProfiles()`. A side-by-side off/enabled
comparison with mirrored pointer rotation shows the material response. The three reviewed
minerals (quartz, calcite, pyrite) show a focused-comparison card describing what to check;
the six unreviewed minerals show that only generic microvariation applies, labeled as an
artistic naturalization layer, not a measured feature. The panel states explicitly that
only stable controls are exposed and that no implementation constants are presented as
measurements.

The earlier SR4 (`surface-detail.html`) and SR5 (`surface-profiles.html`) demos remain
unchanged and are still linked from the demo index.

## Cross-Cutting Test Matrix coverage

The matrix is covered across SR3–SR7; SR7 adds the final public-API, state, and
reduced-motion tests and re-affirms geometry immutability for the surface track. Pixel
comparisons are supporting evidence; scientific direction and face selection are verified
by numeric tests independent of raster output.

| Matrix item | Where covered |
|---|---|
| Face selector and contributor precedence | `crystal-three` SR3 `selectSurfaceRule` (priority, specificity, rule/contributor ID tie-break); SR5 quartz/pyrite face selection |
| Tangent construction: cubic, trigonal/hexagonal-setting, monoclinic, triclinic | `crystal-three` SR3 `createFaceTangentFrame` (reference projection + axis fallback); SR5 quartz (c-axis) and pyrite (edge-derived) directions |
| Stable procedural seeds and state restoration | `crystal-three` SR4 `stableSurfaceSeed` (exact Float32 range, polygon-level sharing); SR7 state round-trip and legacy restore |
| Geometry immutability | `crystal-viewer` SR4/SR6 byte-for-byte vertex/normal/bounds/contributor tests; SR7 re-affirms position+normal immutability under detail toggling |
| Shader fallback when no surface profile exists | `crystal-three` SR3/SR5 unmatched-face `FALLBACK_SURFACE_PROFILE` (0) and unknown-profile rule rejection |
| Context loss, material disposal, mineral replacement | `crystal-viewer` M7 lifecycle (disconnect/reconnect/dispose) and mineral-load replacement tests |
| Transparent, metallic, opaque paths | `crystal-viewer` SR6 transmissive routing (quartz/fluorite/beryl/gypsum/forsterite) and pyrite opaque/metallic bypass |
| Visual regression under pinned renderer/environment/camera/exposure/color space | SR0/SR4 baseline manifests and PNG captures (`docs/baselines/`); SR7 adds no new render pass |

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. At the SR7
audit, the full suite was 471 tests (461 prior + 10 new SR7 tests); the current test count
is reported by `npm run check`.

New focused tests in `packages/crystal-viewer/src/sr7-acceptance.test.ts`:

* Stable API: `getSurfaceDetail` exposes only `enabled` and `strength`; `getSurfaceProfiles`
  exposes only the five stable fields and never seeds/frequencies/amplitudes/uniforms;
  out-of-range strength and non-boolean enable reject without changing state.
* All nine minerals load with surface detail and report reviewed profiles only where
  reviewed: quartz and pyrite have matched faces (`matchedFaceCount > 0`); calcite reports
  its reviewed `{0001}` profile with zero matches; the other six report no profiles.
* State: `STATE_VERSION` is `2`; `surfaceDetail` round-trips through `setState`; a genuine
  legacy version-1 state omitting `surfaceDetail` restores detail off through the V1-to-V2
  migration.
* Geometry immutability: toggling surface detail on and off leaves the position and normal
  arrays byte-for-byte unchanged.
* Reduced-motion: when `matchMedia` reports `prefers-reduced-motion: reduce`, `start()`
  runs the loop but does not advance rotation; without the preference, rotation advances.

All existing SR3–SR6 surface, optics, picking, highlighting, serialization, and lifecycle
tests pass unchanged.

## Accessibility behavior for motion and high-frequency effects

The surface detail (striations and microvariation) is a static procedural pattern; it does
not animate over time and is locked to the crystal. The only continuous motion the viewer
produces is the optional `start()` auto-rotation. When the OS/browser reports
`prefers-reduced-motion: reduce`, the viewer suppresses the rotation increment, so
high-frequency surface detail does not sweep across the screen. The static detail itself
remains visible — it is reviewed typical information, not motion — and on-demand
interaction continues to render. The detection reads `matchMedia` once, caches the
`MediaQueryList`, and is safe outside a browser. The handling lives in `crystal-viewer`
(the browser-facing layer); `crystal-three` surface code remains free of browser APIs. See
[viewer API](viewer-api.md#reduced-motion-and-high-frequency-effects) and
[ADR 0010](decisions/0010-sr7-surface-state-and-reduced-motion.md).

## Performance results

SR7 introduces no new shader, render pass, texture, or geometry work. The reduced-motion
change removes a per-frame rotation update under the preference; the surface-detail
rendering path is unchanged from SR4–SR6. The SR4/SR6 performance envelope therefore holds:
the surface-detail material adds the existing single-pass analytic normal/roughness
contribution within the recorded interactive budget, and opaque/metallic surfaces bypass
transmission cost. The committed baseline manifests in `docs/baselines/` record the
pinned-scene frame timings on the documented headless SwiftShader path; SR7 does not
regenerate those baselines because the render path is unchanged. Headless timings are
supporting regression observations, not a portable interactive-GPU threshold.

## Browser coverage

The viewer targets current Chromium, Firefox, and Safari. The surface-detail shader uses
WebGL 2 standard derivatives (`dFdx`/`dFdy`) and face-local vertex attributes within the
documented attribute-location budget. `prefers-reduced-motion` via `matchMedia` is
supported in all three target engines. The automated regression path uses headless Chrome
with SwiftShader for reproducibility, as recorded in the baseline manifests; it is
supporting evidence, not the sole correctness test. Numeric face-selection and direction
tests run in Node independent of raster output.

## Human visual review workflow

Start the demo server with `npm run serve`, then review the SR7 overview demo without
changing the fixed settings unless noted. The off/enabled comparison uses the project-owned
default studio environment, intensity `1`, AgX tone mapping, exposure `1.15`, and the
preferred-view camera; rotation is mirrored across both sides.

* `http://127.0.0.1:5173/packages/crystal-demo/surface-overview.html` — for each of the
  nine minerals, confirm:
  * the off/enabled sides stay aligned while dragging either crystal;
  * toggling **Surface detail** and the **Strength** slider changes only the enabled side's
    material response, never the silhouette, edges, or face geometry;
  * the profile panel reports reviewed profiles for quartz, calcite, and pyrite only, and
    the generic-microvariation note for the other six.
* Focused comparisons (same URL, select the mineral):
  * **Quartz** — striations appear on prism `m` faces only, perpendicular to `c`, and stay
    crystal-local under rotation; they do not appear on rhombohedra.
  * **Calcite** — the panel reports the reviewed `{0001}` pearly profile with no matching
    shipped growth face; no pearly treatment is inferred from cleavage.
  * **Pyrite** — striations are confined to cube faces and follow edge-relative directions
    that change per adjacent face, not a world or camera axis.
* Reduced-motion (optional): enable the OS reduced-motion preference and confirm the
  `start()`-driven rotation, where used by a host, does not spin; the surface detail
  remains visible. The overview demo itself renders on demand and does not auto-rotate.

Record confirmation or requested changes here before marking SR7 fully closed. No image
inspection is required unless an automated failure or visual defect needs diagnosis.

## Owner visual review

Owner inspected the SR7 overview demo. The stable controls, profile panel, and reviewed
quartz/calcite/pyrite face selection were accepted. One appearance item is deferred:

* **Generic microvariation reads as evenly distributed bumps on all faces.** This is the
  intended SR4 naturalization layer (low-amplitude normal and roughness variation applied
  to every face of every mineral when the toggle is on, separate from the reviewed
  form-specific striations). The owner accepted it for now and will review the bump
  distribution and character more closely later. No change is required at this time; the
  item is tracked here so a later pass can reassess whether the pattern character (sum of
  two directional sinusoids) is appropriate or should read as less directional roughness.

The automated gates pass; the remaining gate is the later human visual judgment on the
deferred item.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
git diff --check
```

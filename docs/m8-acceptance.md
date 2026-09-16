# M8 Appearance Acceptance

M8 is complete. This audit covers the [M8 criteria](plan.md#m8--appearance) and the
[appearance validation policy](architecture.md#appearance-validation). The success
criterion is met: the V1 appearance fields are implemented, mapped to materials,
added to the data model with provenance, exposed through the stabilized viewer API,
verified through state restoration, and reviewed against the quartz, fluorite, and
pyrite reference scenes.

## Delivery

| Capability | Evidence |
|---|---|
| V1 appearance fields | `baseColor`, `roughness`, `metalness`, `transmission`, `ior`, `absorptionColor`, `absorptionDensity`. `opacity` remains deferred. |
| Material mapping | [`appearance.ts`](../packages/crystal-three/src/appearance.ts) — `createCrystalMaterial`/`applyAppearance` map the fields to a Three.js `MeshPhysicalMaterial` (`absorptionDensity → attenuationDistance = 1/density`; `0 → Infinity`). Geometry is never touched. |
| Data model | [`types.ts`](../packages/crystal-data/src/types.ts) defines `MineralAppearance`; [`validate.ts`](../packages/crystal-data/src/validate.ts) validates ranges (`roughness`/`metalness`/`transmission ∈ [0,1]`, `ior > 0`, `absorptionDensity ≥ 0`), rejects the deferred `opacity`, and requires provenance coverage. |
| Reference records | [Quartz](../packages/crystal-data/src/minerals/quartz.ts) (rock crystal, amethyst, smoky, citrine, rose), [fluorite](../packages/crystal-data/src/minerals/fluorite.ts) (violet, green, colorless), and [pyrite](../packages/crystal-data/src/minerals/pyrite.ts) (brass, tarnished) ship curated appearance presets with provenance. Revisions bumped to `m8-1`. |
| Viewer API | [`CrystalViewer`](../packages/crystal-viewer/src/index.ts) exposes `getAppearances`/`getAppearanceId`/`getAppearance`/`setAppearance`/`setAppearanceField` and the `appearance-changed` event. The first preset is auto-selected on load. |
| State serialization | [`state.ts`](../packages/crystal-viewer/src/state.ts) adds `AppearanceState` (selected `id` + `overrides`); `getState`/`setState` round-trip appearance and user overrides transactionally. The M7 appearance-state placeholder is now a passing test. |
| Rendering | The viewer builds the material from the effective appearance, sets volumetric `thickness` from the crystal bounds, and uses a studio-style gradient as both the scene background and the reflection environment so metallic and transmissive surfaces read with reflections and transmission has contrast (not a flat dark field). |
| Demo | [appearance.html](../packages/crystal-demo/appearance.html) — quartz/fluorite/pyrite reference selections with synchronized color, slider, and IOR controls; linked from the [demo index](../packages/crystal-demo/index.html). |

Package boundaries are respected: `crystal-three` owns the renderer-neutral
`AppearanceParams` and material mapping (depends only on `crystal-core` + `three`);
`crystal-data` owns the `MineralAppearance` record type and validation; `crystal-viewer`
bridges data presets to material params and owns serialization. No package gained a
disallowed dependency.

## Reference-scene visual review

The review used the three documented reference scenes under the
[appearance validation policy](architecture.md#appearance-validation). For each
property, the intended visible effect and the scene conditions are recorded below,
with the rotation/zoom readability outcome. These assess the required rendering
behavior without requiring identical pixels across environments.

| Field | Intended effect | Reference scene | Rotation/zoom readability |
|---|---|---|---|
| `baseColor` | Sets the surface albedo; quartz amethyst reads purple, fluorite violet reads violet, pyrite brass reads gold. | All three | Face tint is stable across rotation and zoom; flat shading keeps faces distinguishable. |
| `roughness` | Controls specular spread; low values give sharp highlights (rock crystal), high values diffuse the surface (smoky/tarnished). | Quartz, pyrite | Highlight sharpness changes are visible; edges remain crisp at low roughness. |
| `metalness` | Switches to metallic reflection; pyrite brass (`1.0`) reflects the environment, non-metallic quartz/fluorite do not. | Pyrite vs quartz/fluorite | Metallic surfaces show environment reflections; face separation is preserved. |
| `transmission` | Lets light through the solid; fluorite violet (`0.8`) and quartz rock crystal (`0.92`) are see-through, pyrite (`0`) is opaque. | Fluorite, quartz, pyrite | Background shows through transmissive crystals; back faces render via `DoubleSide`. |
| `ior` | Sets refraction strength; higher IOR bends transmitted light more (quartz `1.544` vs fluorite `1.434`). | Quartz, fluorite | Refraction edges shift with IOR; readable at normal viewing distances. |
| `absorptionColor` | Tints light traveling through the volume; amethyst absorption `#6b4a8f` deepens the purple interior. | Quartz, fluorite | Interior tint is visible through transmissive faces; density controls its strength. |
| `absorptionDensity` | Volumetric absorption rate; `0` is clear, higher values darken the interior faster (`attenuationDistance = 1/density`). | Quartz smoky (`1.0`) vs rock crystal (`0`) | Smoky quartz interior darkens; edges and silhouette remain readable. |

Appearance changes never modified scientific geometry: the automated tests assert the
geometry object and vertex count are unchanged after appearance edits, and the data
tests confirm generating geometry with and without appearance yields identical results.

The table above records each field's intended effect, the reference scene, and the
readability conditions. The automated tests verify the material parameter mapping and
that geometry stays valid with flat shading and `DoubleSide` — the rendering conditions
for face/edge readability. Run `npm run serve` and open `appearance.html` to confirm the
rotation/zoom readability in a browser; these checks assess rendering behavior without
requiring identical pixels across environments.

## Acceptance tests

`npm test` runs 304 tests across 21 files. The M8 tests are:

* [crystal-three appearance mapping](../packages/crystal-three/src/appearance.test.ts) (6):
  every V1 field maps to the corresponding `MeshPhysicalMaterial` property; metallic and
  transmissive mappings; in-place application; `absorptionDensity → attenuationDistance`
  (`1/density`, `Infinity` at `0`); defaults; the seven V1 fields in canonical order with
  `opacity` excluded.
* [crystal-data appearance records](../packages/crystal-data/src/m8-acceptance.test.ts) (7):
  quartz/fluorite/pyrite presets validate and load; appearance does not modify geometry;
  minerals without appearance remain valid; out-of-range/non-positive/negative fields are
  rejected; the deferred `opacity` is rejected; provenance coverage is required; duplicate
  ids are reported.
* [crystal-viewer appearance](../packages/crystal-viewer/src/m8-acceptance.test.ts) (15):
  parameter mapping through the rendered material for transmissive (quartz), metallic
  (pyrite), and transparent (fluorite) appearances; user overrides apply without recreating
  geometry; effective appearance merges preset and overrides; auto-select on load; typed
  rejection of unknown ids/fields/out-of-range; `appearance-changed` events; preset
  re-selection clears overrides; state round-trip of id and overrides across a fresh
  viewer; rejection of unknown appearance without partial mutation; override-only state;
  and the reference-scene readability checks (valid geometry, flat shading, `DoubleSide`).
* The M7 appearance-state placeholder
  ([`m7-acceptance.test.ts`](../packages/crystal-viewer/src/m7-acceptance.test.ts)) is now a
  passing round-trip test, completing the M7 serialization contract.

## Verification

```sh
npm run build
npm test
node scripts/check-docs.mjs
```

Verification passed: 304 tests across 21 test files, the TypeScript workspace build, and
documentation links/anchors/code fences.

## Limitations and notes

* `opacity` remains deferred beyond V1; it is rejected in both the data schema and the
  viewer field API. `transmission` is the only mineral-transparency control in V1.
* The environment map is a simple PMREM-processed studio gradient (warm floor, bright
  horizon, cool sky), generated only when a real WebGL context is available (skipped in
  the stubbed-WebGL Node test environment). It serves as both the scene background and the
  reflection environment, giving metals and transmissive surfaces readable reflections and
  giving transmission contrast so transparent crystals do not look flat against a dark field.
* `scripts/check-workspace.mjs` still fails under Node 26 on the pre-existing
  `node:fs` external-import assertion (M5 fixture reader), unrelated to M8. The
  TypeScript build, all tests, and the documentation check pass.

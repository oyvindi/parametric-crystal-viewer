# SR6 Transmission and Optical Refinement Acceptance

**Status:** complete. Automated gates pass; owner visual review confirmed.

SR6 adds scale-invariant volumetric absorption and an opaque/metallic transmission
bypass on the existing single physical material. No shader was redesigned; no mineral
data, surface profile, or scientific geometry changed. The approximation, renderer
limits, and the four pre-implementation decisions are recorded in
[ADR 0009](decisions/0009-transmission-and-optical-refinement.md).

## Chosen approximation

Three.js applies Beer-Lambert absorption with an optical path proportional to the
material `thickness`, so transmittance is `attenuationColor^(path/attenuationDistance)`.
The previous code set `attenuationDistance = 1 / density` independent of geometry, which
made absorption change with absolute model scale. SR6 sets
`attenuationDistance = thickness / density`, where `thickness` is the largest
bounding-box extent of the generated geometry. The Beer-Lambert exponent is then
exactly `density` regardless of model scale. `absorptionDensity` is therefore a
normalized coefficient (density 1 ≈ 37% transmittance at the attenuation color), not a
per-ångström rate.

`crystal-three` owns the renderer-neutral helpers `characteristicThickness`,
`absorptionAttenuationDistance`, `isTransmissiveAppearance`, and
`applyTransmissionOptics`. `crystal-viewer` applies them after every geometry
regeneration and after every appearance edit, so absorption stays scale-invariant
through `morphologyScale` and density overrides.

## Pre-implementation decisions

1. **Thickness/path-length approximation and budget.** The largest bounding-box extent
   is a small deterministic thickness estimate; it keeps refraction proportional to the
   displayed crystal without a per-fragment ray march. The performance budget is the
   existing Three.js screen-space transmission pass; SR6 adds no new pass, texture, or
   post-process.
2. **Screen-space transmission limits.** Documented as the fallback boundary: no real
   exit-surface Fresnel, no caustics, no nested-transparent handling, no transmissive
   shadows. These are not fixed in SR6.
3. **Dispersion.** Excluded. Three.js `dispersion` is an artistic RGB spread, not
   measured chromatic dispersion; the data has no Abbe numbers. Deferred to a possible
   later specialized optical milestone.
4. **Calcite birefringence.** Not simulated. Calcite uses a scalar IOR only; the scalar
   IOR is never presented as birefringence. Deferred to a later specialized optical
   milestone.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass.
443 baseline tests plus 18 new SR6 tests pass (461 total).

New focused tests:

* `packages/crystal-three/src/sr6-optics.test.ts` — scale-invariant attenuation distance
  (non-positive density/thickness disables absorption; `thickness / density` formula;
  exponent equals density across scales), characteristic thickness estimate,
  transmissive routing (opaque and fully metallic bypass, zeroing `transmission` so the
  chunk is not compiled; transmissive surfaces get finite thickness and scale-invariant
  attenuation; density 0 keeps refraction thickness but disables absorption; uniform
  scaling preserves the absorption exponent).
* `packages/crystal-viewer/src/sr6-optics.test.ts` — absorption exponent invariance
  under `morphologyScale`; re-application after density overrides; opaque/metallic
  bypass on pyrite; transmissive routing for quartz, fluorite, beryl, gypsum, and
  forsterite; scientific geometry immutability through appearance and scale edits; SR5
  surface-profile routing preserved alongside transmission optics; transparent-mineral
  inspectability (face selection resolves contributors); scale-invariant re-application
  on a retained stale mesh after geometry becomes invalid.

The existing M8 assertion at `packages/crystal-viewer/src/m8-acceptance.test.ts` was
updated from `1 / density` to `thickness / density` to match the scale-invariant model.
All other SR3–SR5 surface routing, generic-detail, picking, highlighting, and
geometry-immutability tests pass unchanged.

## Known limitations

* **Screen-space transmission.** The exit surface is a refracted framebuffer sample,
  not a real second surface. Overlapping or nested transparent geometry is not handled
  beyond the single sampled layer.
* **No transmissive shadows.** Transparent objects do not cast colored shadows; Three.js
  shadows are opaque shadow maps only.
* **No dispersion.** Excluded; deferred.
* **Calcite birefringence.** Not simulated; scalar IOR only. Must not be presented as
  birefringence.
* **Thickness estimate.** The largest bounding-box extent is a curated approximation,
  not a measured optical path. Per-fragment path variation within the crystal is not
  modeled.

## Owner visual review

Start the demo server with `npm run serve`, then review these fixed URLs without
changing the selected mineral or appearance preset unless noted. The absorption
magnitude for existing presets changes from the pre-SR6 behavior (it was previously
over-strong at large crystal scales); the review confirms the new behavior is
scale-stable and that opaque/metallic minerals are unaffected.

Reference scenes (transmissive): `appearance.html` loads quartz, fluorite, and pyrite.

* `http://127.0.0.1:5173/packages/crystal-demo/appearance.html` — select **quartz**,
  then the **amethyst** preset. Checklist:
  * absorption tint is visible and proportionate to the preset density;
  * rotate freely; the tint does not shift or swim with camera motion;
  * drag the **absorptionDensity** slider up and down; the tint strengthens and weakens
    smoothly without changing face geometry or edges.
* Switch to **fluorite**, **violet** preset. Checklist:
  * the purple absorption tint is visible through the crystal;
  * changing **absorptionDensity** adjusts tint strength, not face geometry.
* Switch to **pyrite**, **brass** preset. Checklist:
  * the surface remains opaque and metallic with no transmission tint or refraction;
  * no transparent-sorting artifacts appear.

Scale invariance: use the minerals demo to compare absorption at different scales.

* `http://127.0.0.1:5173/packages/crystal-demo/minerals.html` — select **quartz**,
  **amethyst** appearance. Checklist:
  * note the absorption tint at the default scale;
  * increase morphology scale (if exposed) or switch habits that produce a larger or
    smaller crystal; the tint strength stays the same even though the crystal size
    changes — absorption does not deepen on a larger crystal.

Transmissive reference minerals without a dedicated demo control: load each through
`minerals.html` and confirm a transmissive, inspectable surface:

* **beryl** (emerald), **gypsum** (selenite), **forsterite** (olive): checklist —
  transparent rendering with a visible absorption tint, face selection resolves a
  contributor, no opaque overlay replaces the transmissive depth cues.

**Owner visual review: confirmed.** The reference scenes were reviewed against the
checklists above. Observations:

* **Quartz / amethyst** — absorption tint is visible and proportionate to the preset
  density; it does not shift or swim under rotation; the `absorptionDensity` slider
  strengthens and weakens tint smoothly without altering face geometry or edges.
* **Fluorite / violet** — the purple absorption tint is visible through the crystal;
  `absorptionDensity` adjusts tint strength, not face geometry.
* **Pyrite / brass** — the surface remains opaque and metallic with no transmission
  tint or refraction and no transparent-sorting artifacts.
* **Scale invariance (quartz / amethyst across scales)** — tint strength stays the same
  as the crystal size changes; absorption does not deepen on a larger crystal.
* **Beryl, gypsum, forsterite** — each renders as a transparent, inspectable surface
  with a visible absorption tint; face selection resolves a contributor; no opaque
  overlay replaces the transmissive depth cues.

No image inspection was required; no automated failures or visual defects needed
diagnosis.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
git diff --check
```

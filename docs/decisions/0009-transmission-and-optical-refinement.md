# 0009 — Transmission and Optical Refinement

* **Status:** accepted.
* **Context:** The [surface rendering plan](../surface-rendering-plan.md) SR6 step asks for
  path-length-dependent absorption, exit-surface behavior, transmissive shadows, and
  thickness estimation for the quartz, calcite, fluorite, beryl, gypsum, and forsterite
  reference scenes, within the project's documented renderer limits. The V1 renderer is
  Three.js `MeshPhysicalMaterial` with screen-space transmission. Scientific geometry,
  face normals, Miller indices, contributors, picking, and exported geometry must not
  change. Scalar IOR must not be presented as calcite birefringence, and the work must
  not imply dispersion, measured optical constants, or physical accuracy beyond the data.

  Before implementation, four questions had to be resolved and recorded:

  1. *Thickness/path-length approximation and performance budget.*
  2. *Renderer limitations and fallbacks for screen-space transmission.*
  3. *Whether dispersion is worth its cost.*
  4. *The explicit calcite birefringence limitation.*

* **Decision:** Apply a small, testable approximation on the existing single physical
  material rather than redesigning the shader. Three.js computes volumetric absorption
  with Beer-Lambert: transmittance is `attenuationColor^(path/attenuationDistance)`,
  where the optical path length scales with the material `thickness`. The previous code
  set `attenuationDistance = 1 / density` independently of geometry, so absorption
  changed with absolute model scale (a larger crystal absorbed more). The fix sets
  `attenuationDistance = thickness / density`, making the Beer-Lambert exponent equal
  to `density` regardless of model scale. `absorptionDensity` is therefore a normalized
  coefficient (density 1 yields roughly 37% transmittance at the attenuation color), not
  a per-ångström rate.

  `thickness` is the largest bounding-box extent of the generated geometry, a curated
  deterministic estimate that keeps refraction proportional to the displayed crystal.
  It is not a measured optical path. The estimate is computed renderer-neutrally in
  `crystal-three` (`characteristicThickness`, `absorptionAttenuationDistance`,
  `isTransmissiveAppearance`, `applyTransmissionOptics`) and applied by `crystal-viewer`
  after every geometry regeneration and every appearance edit, so absorption stays
  scale-invariant through morphology-scale and density-override changes.

  Opaque (`transmission <= 0`) and fully metallic (`metalness >= 1`) surfaces bypass
  transmission work: they receive the transmission defaults (`transmission` 0,
  `thickness` 0, `attenuationDistance` `Infinity`, `transparent` false) and never
  enter the transmission render pass. Three.js compiles the transmission chunk only
  when `material.transmission > 0`; `applyTransmissionOptics` zeroes `transmission`
  for non-transmissive surfaces, so the bypass is exact, not a no-op shader branch.
  The performance budget is the existing Three.js screen-space transmission pass; SR6
  adds no new render pass, texture, or post-process.

  Renderer limitations (documented, not fixed):

  * Transmission is screen-space. The exit surface is approximated by refracting the
    view ray through `thickness` and sampling the opaque framebuffer; there is no real
    exit-surface Fresnel, no caustics, and no proper handling of overlapping or nested
    transparent geometry beyond the single sampled layer.
  * There are no transmissive shadows: transparent objects do not cast colored shadows
    onto surfaces behind them. Three.js shadows are opaque shadow maps only.
  * Dispersion is **excluded**. Three.js exposes a `dispersion` uniform, but it is a
    per-material artistic RGB spread, not measured chromatic dispersion, and the data
    does not report Abbe numbers or sellmeier coefficients. Enabling it would imply
    optical accuracy the project does not have. Dispersion is deferred to a possible
    later specialized optical milestone.
  * Calcite is rendered with a scalar IOR only. Calcite birefringence (ordinary and
    extraordinary refractive indices and direction-dependent ray splitting) is **not
    simulated**. The scalar IOR must never be presented as birefringence. Birefringence
    belongs in a later specialized optical milestone; the SR6 limitation is documented
    in [viewer appearance](../viewer-api.md#appearance-controls) and this record.

* **Alternatives:**
  * *Per-ångström absorption (keep `1 / density`)* — simplest, but absorption changes
    with `morphologyScale`, violating the acceptance criterion that model scale not
    cause unexplained changes in absorption.
  * *Geometry ray-marched thickness per fragment* — more physically motivated path
    lengths, but adds a shader pass and couples rendering to per-fragment geometry
    queries beyond the documented renderer limits; not justified for the small
    reference scenes.
  * *Enable Three.js `dispersion`* — cheap, but presents an artistic RGB spread as
    optical dispersion without measured data.
  * *Two-IOR calcite material* — would require a custom anisotropic shader and is out
    of scope for a scalar-IOR renderer; risks presenting scalar IOR as birefringence.
* **Consequences:** Absorption is now scale-invariant and `absorptionDensity` is a
  normalized coefficient; the visual absorption magnitude for existing presets changes
  (it was previously over-strong at large crystal scales). Opaque and metallic paths
  pay no transmission cost. Scientific geometry, picking, sorting, and SR3–SR5 surface
  routing are unchanged. The documented screen-space limitations (no caustics, no
  transmissive shadows, no dispersion, no birefringence) remain the known fallback
  boundary. All constants remain labeled as curated, not measured.
* **References:** [SR6 plan](../surface-rendering-plan.md#sr6--transmission-and-optical-refinement),
  [Three.js rendering layer](../architecture.md#threejs-rendering-layer),
  [Mineral Appearance](../data-model.md#mineral-appearance),
  [ADR 0007](0007-generic-surface-microvariation.md), and
  [ADR 0008](0008-reviewed-surface-profiles.md).

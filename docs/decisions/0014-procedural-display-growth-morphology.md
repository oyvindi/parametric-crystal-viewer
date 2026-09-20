# 0014 — Procedural Display Growth Morphology

* **Status:** accepted.
* **Context:** The renderer's current face-local surface profiles intentionally change
  only shading. They cannot represent literal terraces, hopper recesses, child crystals,
  or window/fenster frames without changing silhouette, occlusion, and transmission
  paths. The crystallographic core must remain renderer-neutral and retain the
  idealized, convex morphology used for scientific inspection and default export.
  Fluorite has a reviewed natural-growth observation of layers parallel to `{100}`;
  its exact terrace dimensions and specimen-specific arrangement are not reported.
* **Decision:** Keep the generated scientific geometry as the **idealized core mesh**.
  The default morphology mode renders that mesh directly. Add an optional procedural
  display-growth layer that derives render-only geometry from the idealized core mesh
  without modifying it.

  The layer is a composable collection of display mesh components. Every component that
  represents a solid must be closed and watertight, allowing future child crystals,
  penetration twins, and window/fenster frames without requiring one monolithic mesh.
  Every display triangle maps to an originating idealized core face. Picking a display
  triangle resolves to that core face and exposes no public terrace, child-crystal, or
  other display-feature identity.

  The first implementation slice is a curated fluorite `{100}` display interpretation:
  a coherent seeded field of attached small cubic child-growth components on faces
  selected by the shipped cube form `a`. It is not a specimen reconstruction or a
  claim that its child dimensions, density, placement, or regularity were measured. The current appearance, lighting,
  transmission, camera, and global surface-detail controls apply to display geometry.
  Existing reviewed face-local profiles do not apply automatically; a future mapping
  must be explicit.

  The viewer calls this optional mode **display-growth mode**. Its initial preset label
  is **Terraced fluorite**, with **stepped cubic growth** as a descriptive term.
  **Hopper-style** remains distinct from this preset. A future quartz preset may use **Fenster (window) quartz**, with
  **skeletal quartz** and **window quartz** as aliases. **Elestial** is a search synonym
  only, not a scientific category or procedural rule.
* **Alternatives:**
  * *Displace the idealized core mesh or reuse SR9 normal mapping* — rejected. Shader
    detail cannot make literal terraces or frames, while modifying core vertices would
    contaminate scientific geometry, picking, and default export.
  * *Require one closed mesh for the entire display form* — rejected. It makes later
    child crystals, twins, and nested window structures unnecessarily difficult.
  * *Expose display-feature picking* — deferred. Core-face-only picking preserves the
    established scientific inspection contract for the first implementation.
  * *Use collector terminology as a scientific taxonomy* — rejected. These terms are
    useful for discovery but vary in scope and must not promote an evidence claim.
* **Consequences:**
  * `crystal-core` remains unchanged and contains no display-growth generation.
  * `crystal-three` owns render-only display mesh construction and triangle-to-core-face
    attribution; `crystal-viewer` owns display-mode selection, lifecycle, state, and
    public picking resolution; `crystal-data` owns future claims, labels, aliases, and
    provenance.
  * Display-mode API and serialized-state fields, exact mesh algorithms, component
    topology, material-profile routing, and display-geometry export are deferred to the
    implementation design. Default scientific export remains the idealized core mesh;
    any display export requires an explicit user choice and label.
  * A renderer-neutral boolean union of the core solid and display-growth solids is
    accepted and integrated. It removes overlapping internal display surfaces and
    composes shallow edge/corner growth blocks that cross adjacent faces under a
    deterministic core-face attribution rule. The union is dependency-free, produces a
    single closed watertight component with per-triangle core-face provenance, and
    preserves deterministic regeneration including reordered operands. GPU conversion
    centers Float64 positions before casting to Float32. The viewer validates new
    geometry before disposing the previous mesh so a rejected union leaves the viewer
    in its prior state. The [2026-09-20 spike results](../sr10-boolean-design.md#spike-results)
    established the dependency-free path; the [edge/corner experiment](../sr10-corner-growth-design.md)
    received [owner visual approval](../sr10-corner-growth-design.md#owner-review)
    on 2026-09-20. No general CSG dependency was introduced.
  * Validation must prove that the idealized core mesh and its bounds, normals,
    contributors, scientific picking result, and default export remain unchanged when
    display-growth mode is enabled. It must also validate watertight components,
    deterministic regeneration, core-face attribution, and correct resource disposal.
* **References:** [SR10](../surface-rendering-plan.md#sr10--procedural-display-growth-morphologies),
  [CIF-derived morphology](../scientific-model.md#cif-derived-morphology),
  [Three.js rendering layer](../architecture.md#threejs-rendering-layer),
  [picking and face inspection](../viewer-api.md#picking-and-face-inspection),
  [surface-rendering acquisition record](../sources/surface-rendering-acquisition.md),
  and [ADR 0006](0006-face-local-surface-encoding.md).

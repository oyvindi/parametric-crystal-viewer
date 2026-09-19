# 0007 — Generic Surface Microvariation and Deterministic State

* **Status:** accepted.
* **Context:** SR4 requires optional low-amplitude microvariation and an edge response
  without moving scientific vertices, changing bounds or picking, creating triangle
  seams, swimming under motion, or making an undocumented mineral-specific claim.
  Enabled effects must restore to the same realization.
* **Decision:** Extend the existing single `MeshPhysicalMaterial` through
  `onBeforeCompile`. Continuous centered face-local coordinates drive analytic normal
  and roughness variation. One stable 24-bit integer seed attribute is derived from
  mineral, habit, appearance, core-face index, and sorted contributor identity. Values
  are exact in `Float32`; no camera, time, or world-space input enters the pattern.

  Edge response is a restrained grazing-angle shading contribution. There is no vertex
  displacement, screen-space post-process, bevel mesh, or change to silhouette. One
  public strength controls the generic layer in `[0, 1]`, and an explicit off state
  supplies shader strength zero. Both values are an optional additive member of
  version-1 viewer state; legacy states restore off, avoiding a version migration while
  making enabled restoration deterministic.
* **Alternatives:**
  * *Texture assets* — require sampling, lifecycle, and seam policy without improving
    this generic procedural layer.
  * *World- or screen-space noise* — can swim as the model or camera moves.
  * *Geometry bevel or displacement* — changes bounds or silhouette and risks picking
    divergence from scientific geometry.
  * *Unserialized random seed* — cannot guarantee state restoration.
* **Consequences:** The render path uses five vertex-attribute locations, below the
  WebGL 2 minimum of sixteen. The shader pays a small analytic cost even when installed
  with strength zero, but the zero branch preserves output and the default remains off.
  The pattern is explicitly curated renderer behavior, not observed mineral data. SR5
  form-specific profiles remain separate and unimplemented.
* **References:** [SR4 plan](../surface-rendering-plan.md#sr4--generic-microvariation-and-edge-response),
  [SR4 acceptance audit](../sr4-acceptance.md), and
  [Three.js rendering layer](../architecture.md#threejs-rendering-layer).

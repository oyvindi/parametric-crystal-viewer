# 0006 — Face-Local Surface Selection and GPU Encoding

* **Status:** accepted.
* **Context:** The [surface rendering plan](../surface-rendering-plan.md) SR3 step needs
  deterministic selection and crystal-local coordinates for each generated face while
  retaining all tied contributors and the existing triangle-to-core-face picking map.
  Scientific vertices and contributor metadata must remain renderer-neutral and
  immutable. Shared polyhedron vertices cannot carry different tangents or coordinates
  for adjacent polygon faces.
* **Decision:** `crystal-three` expands core polygon faces into per-triangle render
  vertices and adds three attributes: `surfaceProfile` (one scalar profile ID),
  `surfaceTangent` (a crystal-local tangent), and `surfaceCoord` (two centered local
  coordinates). The bitangent is the cross product of the core outward normal and
  tangent. Together with position this consumes four vertex-attribute locations, below
  the WebGL 2 minimum of sixteen; profile IDs are restricted to positive integers no
  greater than 65,535 and profile zero is the fallback.

  Selectors may combine form ID, normalized unoriented Miller family, and exact oriented
  Miller indices. Across tied contributors, explicit numeric priority wins, then selector
  specificity, lexical rule ID, and lexical contributor form ID. Input order never
  controls selection. Tangents project a rule's crystal-local Cartesian reference
  direction into the face; a reference parallel to the normal falls back to the
  least-aligned positive crystal Cartesian axis. A single diagnostic shader material
  validates profile routing; production remains a single physical material until SR4
  and SR5 define actual effects.
* **Alternatives:**
  * *One material per face* — simple, but creates avoidable draw calls and disposal
    complexity as habits change.
  * *Indexed shared vertices* — smaller, but cannot represent face-local coordinates or
    tangents at hard polygon boundaries without vertex duplication.
  * *Primary contributor only* — loses tied-form provenance and makes selection depend
    on an incidental ordering.
  * *Texture lookup by face ID* — adds texture-size and update complexity before SR4 has
    established a need for a larger per-face payload.
* **Consequences:** Render vertex count increases to three vertices per triangle, while
  core geometry, bounds, face normals, contributors, and serialization remain unchanged.
  The existing triangle ordering still maps directly to core face indices for picking
  and highlighting. Rules can be re-resolved by replacing only face-local attributes;
  positions, indices, mesh identity, and picking order remain stable. Imported measured
  faces with no matching rule receive profile zero rather than an inferred treatment.
* **References:** [Three.js rendering layer](../architecture.md#threejs-rendering-layer),
  [SR3 acceptance audit](../sr3-acceptance.md), and
  [Face-Local Material Infrastructure](../surface-rendering-plan.md#sr3--face-local-material-infrastructure).

# 0008 — Reviewed Surface Profile Data and Renderer Mapping

* **Status:** accepted.
* **Context:** SR5 adds quartz prism striations, calcite basal pearly luster, and
  pyrite cube striations. The reviewed facts must remain traceable without putting
  renderer-selected frequency, amplitude, phase, or irregularity into scientific data.
  The current calcite habits have no `{0001}` face, and a cleavage-only observation
  must not transfer to generated growth faces.
* **Decision:** `crystal-data` records `surfaceProfiles` with stable profile and claim
  IDs, kind, growth-face selector, documented directional relationship when applicable,
  and a concise typical/not-specimen-measured description. `crystal-three` recognizes
  only the three reviewed IDs and maps them to face-local profile IDs and curated shader
  constants. Missing, unknown, ambiguous, and unmatched records map to profile zero.
  Quartz uses crystal c as the across-striae coordinate; pyrite derives each tangent
  from the oriented cube face and a cyclic symmetry-equivalent cube/pyritohedron `{210}`
  intersection edge. Calcite's `{0001}` profile is eligible only on matching generated
  growth faces; the shipped calcite habits presently match none. The viewer exposes
  read-only effective-profile information, not a specimen-measurement claim.
* **Alternatives:**
  * *Embed procedural values in mineral data* — incorrectly presents renderer choices
    as documented mineral measurements.
  * *Use world-space stripe directions* — breaks during model rotation and does not
    express the reviewed crystallographic relationships.
  * *Apply calcite pearly luster to all faces or cleavage-derived faces* — exceeds the
    accepted growth-face evidence.
  * *Infer future profiles by kind* — turns absent or ambiguous evidence into a claim.
* **Consequences:** New reviewed cases need both a traceable data record and explicit
  renderer mapping. The three profile constants are documented as curated. Core geometry
  and inspection remain untouched; one physical material remains in use.
* **References:** [SR5 plan](../surface-rendering-plan.md#sr5--reviewed-form-specific-profiles),
  [source acquisition record](../sources/surface-rendering-acquisition.md),
  [ADR 0006](0006-face-local-surface-encoding.md), and
  [ADR 0007](0007-generic-surface-microvariation.md).

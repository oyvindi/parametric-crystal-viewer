# Surface Rendering Implementation Plan

This document sequences a post-V1 improvement to mineral surface rendering for the
records currently shipped by `crystal-data`. It does not change the V1 checklist or
the scientific geometry contracts. The [product specification](spec.md),
[data model](data-model.md), [architecture](architecture.md), and
[viewer API](viewer-api.md) remain authoritative.

The separate [surface-data automation draft](surface-data-automation-draft.md)
describes a possible future source-ingestion system. That system is not required for
this plan: the first surface records are small enough to curate and review directly.
Exact source locations, access constraints, candidate claims, and acquisition status
are tracked in the
[surface-rendering acquisition record](sources/surface-rendering-acquisition.md).

## Outcome

Make the current minerals look less uniformly synthetic while keeping every visual
claim traceable and keeping cosmetic detail out of crystallographic geometry.

The completed work should provide:

* useful default image-based lighting and presentation;
* categorical luster profiles such as vitreous, pearly, metallic, and dull;
* material and procedural detail selected per generated crystallographic face;
* restrained, deterministic microvariation for naturalism;
* directional striations only for reviewed mineral-form combinations;
* improved transmission and absorption behavior; and
* explicit provenance for scientific claims and explicit labeling of renderer-chosen
  parameters.

It does not attempt to reconstruct a specimen's microscopic surface from a structural
CIF, predict growth conditions, or treat procedural noise as measured data.

## Required Separation

Keep three kinds of information distinct:

| Layer | Example | Owner |
|---|---|---|
| Reported or documented claim | Quartz prism faces are commonly striated in a documented direction | `crystal-data`, with provenance |
| Curated renderer mapping | `vitreous` maps to a dielectric material profile | `crystal-three` |
| Procedural realization | Seed, phase, spacing, and small amplitude variation for one displayed face | `crystal-three` / `crystal-viewer` state |

Surface effects must not move scientific vertices, change face normals used for
inspection, alter Miller indices, or affect exported scientific geometry. Any future
displaced or damaged display mesh must be a separately identified rendering artifact.

## Current Mineral Scope

The current catalog contains albite, anatase, beryl, calcite, fluorite, forsterite,
gypsum, pyrite, and quartz. All receive the common lighting and microvariation work.
Form-specific treatment is enabled only after its evidence gate passes.

| Mineral | Initial rendering target | Form-specific evidence gate |
|---|---|---|
| Quartz | Vitreous transparent presets; directional prism-face striations | Confirm form selector and direction in a freely accessible source |
| Calcite | Vitreous material; pearly basal `{0001}` treatment where that form is present | Confirm that the statement applies to a growth face; do not transfer cleavage appearance to growth faces |
| Pyrite | Metallic response; directional cube-face striations | Confirm affected forms and crystallographic/edge-relative direction |
| Fluorite | Improved vitreous transmission, absorption, and subtle smooth-face variation | Research form-specific surface effects before adding any pattern |
| Anatase | Improved luster and subtle smooth-face variation | Research form-specific surface effects before adding any pattern |
| Albite | Improved luster and subtle smooth-face variation | Distinguish growth-face texture from cleavage and twinning before adding a pattern |
| Beryl | Improved vitreous transmission and subtle smooth-face variation | Confirm affected prism forms and direction before adding striations |
| Forsterite | Improved vitreous material and subtle smooth-face variation | Research form-specific surface effects before adding any pattern |
| Gypsum | Improved transparent/pearly presentation and subtle smooth-face variation | Distinguish basal or cleavage appearance from growth-face appearance |

Absence of reviewed evidence means `none`, not `smooth`, and never authorizes a
mineral-specific procedural pattern. A generic low-amplitude microvariation may be
enabled as an explicitly artistic naturalization layer.

## Delivery Sequence

### SR0 — Evidence and Reference-Scene Baseline

**Status:** complete. See the [SR0 acceptance audit](sr0-acceptance.md).

Before shader work:

* capture deterministic reference scenes for all nine minerals under the same neutral
  environment, exposure, camera framing, and output size;
* inventory every current appearance preset and its provenance;
* create reviewed claim records for the initial quartz, calcite, and pyrite cases;
* record whether each claim describes a growth face, cleavage surface, fracture, or
  manufactured/polished surface; and
* choose the comparison scenes and performance hardware for later acceptance.

Begin with the source queue and restrictions in the
[acquisition record](sources/surface-rendering-acquisition.md). New sources must be
added there before their claims enter mineral data.

Do not copy source prose or figures into distributable data unless their license permits
it. Store concise factual claims, citations, derivation notes, and only the minimum
evidence excerpt needed by the project's review process.

Acceptance:

* each form-specific candidate has a stable source reference and review status;
* crystallographic notation has been checked against the rendered source, including
  overbars; and
* baseline screenshots and frame timings are reproducible.

### SR1 — Lighting and Presentation Defaults

**Status:** complete. See the [SR1 acceptance audit](sr1-acceptance.md).

Improve the neutral reference environment, environment intensity, exposure, tone
mapping, and reflected light shapes. Provide a useful built-in or project-owned default
that does not depend on a remote runtime asset. Preserve all existing user environment
controls.

Acceptance:

* faces and edges remain readable across opaque, metallic, and transmissive reference
  minerals;
* the same environment is used for before/after comparisons;
* environment assets have recorded origin and redistribution terms; and
* no scientific geometry or picking result changes.

### SR2 — Categorical Luster Model

**Status:** complete. See the [SR2 acceptance audit](sr2-acceptance.md).

Add a small controlled vocabulary to mineral appearance data. Begin with only the
categories required by the current minerals. Map categories to renderer parameters in
`crystal-three`; keep optional preset overrides for color, roughness, transmission,
IOR, and absorption.

Resolve before implementation:

* exact initial vocabulary and fallback category;
* whether pearly rendering uses sheen, clearcoat, a custom shader contribution, or a
  combination;
* how categorical luster interacts with existing numeric overrides; and
* whether the new field enters serialized viewer state or is fully resolved through
  the selected appearance preset.

Acceptance:

* categorical mappings are centralized and unit tested;
* existing presets retain compatible behavior when the new field is absent;
* the viewer reports effective resolved appearance; and
* every renderer constant is identified as curated rather than measured.

### SR3 — Face-Local Material Infrastructure

Use the existing triangle-to-core-face mapping and face contributors to carry a stable
surface selector into rendering. Establish a local tangent frame per face from its
normal and a crystallographic reference direction. Handle the degenerate case where
the chosen reference direction is parallel to the normal.

Prefer a single shader/material strategy over one material per face unless profiling
shows that material grouping is simpler and sufficiently efficient. Picking and face
inspection must continue to resolve the original core face and all tied contributors.

Resolve before implementation:

* selection precedence when a face has tied contributing forms;
* whether selectors address a form ID, normalized Miller family, oriented face, or a
  combination;
* stable tangent orientation across symmetry-equivalent faces;
* GPU encoding for face profile IDs and local coordinates; and
* WebGL 2 attribute/texture limits for the supported maximum face count.

Acceptance:

* a test material can distinguish selected forms without geometry regeneration;
* symmetry-equivalent faces receive expected orientations;
* picking, highlighting, serialization, and morphology sliders continue to work; and
* imported measured faces with no matching rule use the documented fallback.

### SR4 — Generic Microvariation and Edge Response

Add optional, low-amplitude procedural normal and roughness variation. Seed it from
stable mineral, habit, appearance, and face identifiers so state restoration and image
tests are deterministic. Add a screen- or object-space edge highlight/bevel
approximation only if it does not change the scientific silhouette at normal viewing
distance.

Controls must include an off state and a strength limit. Generic noise must not be
described as a mineral-specific observed feature.

Acceptance:

* scientific buffers and bounds are byte-for-byte unchanged;
* repeated rendering from the same state uses the same procedural realization;
* no visible texture seams occur at triangle boundaries within one polygonal face;
* patterns do not swim under camera or model motion; and
* performance remains within the recorded interactive budget.

### SR5 — Reviewed Form-Specific Profiles

Implement the first three reviewed cases in this order:

1. quartz prism-face striations;
2. calcite pearly `{0001}` faces, without treating cleavage alone as a growth-face
   texture rule; and
3. pyrite cube-face striations.

Direction must be derived from crystallographic axes, indexed directions, or explicit
face-edge relationships—not from world or camera coordinates. Frequency, amplitude,
phase, and irregularity are curated visualization ranges unless a source reports a
measurement. Profiles must state which fields are documented and which are curated.

After these cases pass visual and scientific review, research the remaining six
minerals. Adding another profile is a data change, not a shader redesign.

Acceptance:

* each effect appears only on matched faces;
* direction remains correct during arbitrary model rotation and habit adjustment;
* opposite and symmetry-equivalent faces behave according to the reviewed rule;
* absent, ambiguous, and conflicting evidence falls back without guessing; and
* the UI can identify that surface detail is documented-typical rather than
  specimen-measured.

### SR6 — Transmission and Optical Refinement

Improve path-length-dependent absorption, exit-surface behavior, transmissive shadows,
and thickness estimation for quartz, calcite, fluorite, beryl, gypsum, and forsterite
reference scenes. Do not present a scalar IOR material as a simulation of calcite
birefringence.

Resolve before implementation:

* acceptable approximation and performance budget for thickness;
* whether screen-space transmission limitations require a documented fallback;
* whether dispersion is worth its cost; and
* whether birefringence belongs in a later specialized optical milestone.

Acceptance:

* model scale does not cause unexplained changes in absorption;
* opaque and metallic paths do not pay unnecessary transmission cost;
* known renderer limitations are visible in documentation; and
* transparent objects remain sortable and inspectable in the supported scenes.

### SR7 — Public API, Demo, and Acceptance Audit

Add a surface-detail demo covering all nine current minerals, with focused quartz,
calcite, and pyrite comparisons. Expose only stable controls: enable/disable, overall
strength if retained, and effective profile information. Avoid exposing implementation
constants as scientific measurements.

Define state migration before changing the serialized schema. Record visual review,
automated mapping tests, performance results, accessibility behavior for motion or
high-frequency effects, and browser coverage in a surface-rendering acceptance audit.

## Cross-Cutting Test Matrix

At minimum, test:

* face selector and contributor precedence;
* tangent construction for cubic, trigonal/hexagonal-setting, monoclinic, and triclinic
  examples;
* stable procedural seeds and state restoration;
* geometry immutability;
* shader fallback when no surface profile exists;
* context loss, material disposal, and mineral replacement;
* transparent, metallic, and opaque rendering paths; and
* visual regression scenes under a pinned renderer, environment, camera, exposure,
  and output color space.

Pixel comparisons are supporting evidence, not the sole correctness test. Scientific
direction and face selection require numeric tests independent of raster output.

## Decisions Deferred

The following require prototypes or evidence and are intentionally not decided here:

* exact `crystal-data` schema and version migration;
* shader extension mechanism and WebGL/WebGPU portability;
* material grouping versus shader-side profile lookup;
* exact procedural functions and renderer constants;
* treatment of tied face contributors;
* built-in environment asset and its license;
* serialized state coverage for seeds and surface controls;
* whether geometric displacement or damage is ever supported; and
* whether advanced anisotropic optics warrants a separate milestone.

Adopt durable choices through the normal architecture or decision-record process.

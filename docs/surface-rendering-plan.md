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

**Status:** complete. See the [SR3 acceptance audit](sr3-acceptance.md).

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

**Status:** complete. See the [SR4 acceptance audit](sr4-acceptance.md).

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

**Status:** complete. See the
[SR5 acceptance audit](sr5-acceptance.md).

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

**Status:** complete. See the [SR6 acceptance audit](sr6-acceptance.md) and
[ADR 0009](decisions/0009-transmission-and-optical-refinement.md).

Improve path-length-dependent absorption, exit-surface behavior, transmissive shadows,
and thickness estimation for quartz, calcite, fluorite, beryl, gypsum, and forsterite
reference scenes. Do not present a scalar IOR material as a simulation of calcite
birefringence.

Resolve before implementation:

* acceptable approximation and performance budget for thickness;
* whether screen-space transmission limitations require a documented fallback;
* whether dispersion is worth its cost; and
* whether birefringence belongs in a later specialized optical milestone.

The chosen approximation is scale-invariant `attenuationDistance = thickness / density`
on the existing single physical material; dispersion is excluded, calcite birefringence
is not simulated, and screen-space transmission limits (no caustics, no transmissive
shadows, no nested-transparent handling) are documented as the known fallback boundary.

Acceptance:

* model scale does not cause unexplained changes in absorption;
* opaque and metallic paths do not pay unnecessary transmission cost;
* known renderer limitations are visible in documentation; and
* transparent objects remain sortable and inspectable in the supported scenes.

### SR7 — Public API, Demo, and Acceptance Audit

**Status:** complete. See the [SR7 acceptance audit](sr7-acceptance.md) and
[ADR 0010](decisions/0010-sr7-surface-state-and-reduced-motion.md). One generic-microvariation
appearance item is deferred for later review; see the acceptance audit.

Add a surface-detail demo covering all nine current minerals, with focused quartz,
calcite, and pyrite comparisons. Expose only stable controls: enable/disable, overall
strength if retained, and effective profile information. Avoid exposing implementation
constants as scientific measurements.

Define state migration before changing the serialized schema. Record visual review,
automated mapping tests, performance results, accessibility behavior for motion or
high-frequency effects, and browser coverage in a surface-rendering acceptance audit.

### SR8 — Descriptive Appearance-Claim Catalogue

**Status:** complete. See the [SR8 acceptance audit](sr8-acceptance.md). This phase
improves the catalogue's scientific description of how minerals commonly appear; it
does not by itself add a renderer effect.

The current `MineralAppearance` presets contain selected rendering inputs, while
`surfaceProfiles` contains only renderer-eligible, reviewed growth-face rules. Add a
separate, provenance-backed descriptive-claim layer in `crystal-data` so the catalogue
can preserve evidence that is useful to a reader but is not yet safe to realize as a
face-local shader treatment. The exact record shape and validation contract belong in
the [data model](data-model.md#mineral-appearance), not in this plan.

Each claim must identify:

* a stable ID, concise factual paraphrase, and provenance coverage;
* the visual property — initially colour/variety, diaphaneity, luster, striations,
  growth steps or terraces, cleavage appearance, twinning appearance, fibrous
  appearance, coating/tarnish, or other explicitly named surface character;
* its scope: general mineral or variety, a crystallographic form when known, and the
  surface origin (`growth-face`, `cleavage`, `fracture`, `twinning`, aggregate/fibrous,
  weathered/coated, or unknown);
* typicality when the source states it; and
* an explicit renderer disposition: `descriptive-only`, `candidate`,
  `renderer-eligible`, `blocked`, or `rejected`, with the reason when it is not
  renderer-eligible.

Do not duplicate the renderer's RGB, roughness, transmission, IOR, or procedural
constants in these claims. Those remain curated mappings. A colour claim describes a
reported range, variety, zoning, or other source fact; it does not assert that a
single hex value is measured. Likewise, a luster or diaphaneity claim must not imply
that the current material model simulates birefringence, pleochroism, dispersion,
inclusions, fluorescence, or other unsupported optical effects.

Start with the current nine-mineral catalogue and the source queue in the
[surface-rendering acquisition record](sources/surface-rendering-acquisition.md).
Record concise paraphrases and citations only; do not commit restricted PDFs, scans,
figures, or substantial source excerpts. Add a source to that record before a new
claim enters the catalogue.

Initial classification targets:

| Mineral(s) | Claim coverage to capture | Initial disposition |
|---|---|---|
| Quartz, calcite, pyrite | Existing accepted growth-face claims, plus general luster/appearance context where sourced | Keep the three existing profiles renderer-eligible; other claims descriptive-only unless separately accepted |
| Albite | Vitreous luster, pearly cleavage appearance, and polysynthetic twinning striae | Cleavage descriptive-only; twinning blocked pending twinning and surface-origin support |
| Anatase | Adamantine-to-splendent/metallic luster range; candidate pyramidal-face striations | Keep striations candidate until the source's pyramid notation and local direction are reconciled with the shipped habits |
| Beryl | Vitreous/resinous luster range and transparency | Descriptive-only; any prism striation remains candidate until a reliable form-specific source is reviewed |
| Fluorite | Vitreous luster and rounded or stepped morphology; `{100}` growth terraces | The reviewed natural-growth claim has been promoted to the `growth-steps` profile; keep `{100}`/`{111}` etch pits separate and unimplemented pending dissolution review |
| Forsterite | Vitreous luster and striations parallel to elongation | Striation blocked until the elongation direction is resolved for the shipped habits |
| Gypsum | Coarse `[001]` striations, subvitreous luster, pearly `{010}` cleavage, and silky fibrous material | Growth-face striation candidate until its affected form is known; cleavage and fibrous claims descriptive-only |

Promotion from a descriptive claim to `surfaceProfiles` requires all of the existing
SR0/SR5 gates: an accessible traceable source, an unambiguous mineral identity and
crystallographic basis, a compatible generated-face selector, an explicit growth-face
origin, and—when directional—a verified local crystallographic direction. Promotion
is a reviewed data change, not an automatic consequence of adding a descriptive
claim. Claims with an unknown origin, or ones about cleavage, fracture, twinning,
fibrous aggregates, polishing, coatings, or weathering, must never match ordinary
generated growth faces.

Acceptance:

* all nine shipped minerals have at least one provenance-backed descriptive appearance
  claim or an explicit documented no-claim outcome for each researched category;
* every claim has a stable ID, source reference, property, scope/origin, disposition,
  and concise paraphrase;
* validation rejects unknown property, origin, disposition, missing provenance, and
  a renderer-eligible claim without a compatible growth-face selector;
* catalogue tests demonstrate that descriptive-only, blocked, and candidate claims
  cannot alter materials or select faces;
* only reviewed, promoted claims can become renderer-active mineral-specific rules;
  the current active profiles are quartz, calcite, pyrite, and fluorite; and
* documentation distinguishes reported observations from curated appearance presets
  and renderer constants.

### SR9 — Face-Local Growth Steps and Dissolution

**Status:** in progress. Fluorite `{100}` growth steps are implemented as the first
reviewed slice: the promoted natural-growth claim selects only the shipped cube form,
and the renderer uses deterministic face-local normal and roughness variation with
curated spacing, height, density, and phase. This is a typical visualization cue, not
a measurement of the displayed specimen. SR9 remains incomplete: etch pits, a quartz
etch profile, visual-regression acceptance evidence, and the SR9 acceptance audit have
not been completed.

This phase adds only face-local, shader-realized detail. It must not make a convex
idealized crystal appear to have measured non-convex morphology.

Extend the reviewed surface-profile vocabulary with `growth-steps` and `etch-pits`.
Their factual claims must distinguish growth from dissolution and identify a
crystallographic face family or form. Add an explicit dissolution/etch surface origin
to the descriptive-claim model before accepting a natural etching claim; laboratory
etching may inform mechanism but cannot by itself establish a typical natural-specimen
renderer profile.

Start with two evidence-gated candidates:

1. **Fluorite `{100}` terraces.** Review evidence for two-dimensional growth layers
   parallel to `{100}`, separately from etch pits reported on `{100}` and `{111}`.
   Do not generalize the rule to every fluorite face or imply that the displayed
   specimen is stepped.
2. **Quartz etching.** Add natural quartz etching as a descriptive claim first.
   A `z`-face profile is eligible for review only if the source supports the observed
   feature, its natural dissolution origin, and its face selector. Synthetic or
   deliberately etched quartz remains mechanism-only evidence.

Anatase striations are a parallel candidate, not an SR9 implementation target: first
resolve whether the reported pyramidal faces map unambiguously to a shipped form and
whether the feature is representative beyond its documented locality.

The renderer may use deterministic, sparse normal and roughness perturbations in a
face-local crystallographic frame. It must not displace vertices, add cavities to the
silhouette, change face picking, or simulate source-measured pit size, density, or
depth. Growth steps and etch pits need distinct profiles, seeds, and visual language:
etched pits must not read as raised growth terraces.

Acceptance:

* every activated profile has a reviewed growth or dissolution claim, compatible face
  selector, and source-specific scope;
* `{100}` fluorite growth steps and fluorite `{100}`/`{111}` etch pits remain separate;
* the quartz effect appears only on the accepted face class and is identified as a
  typical feature, never a measurement of the displayed specimen;
* enabling either effect leaves core geometry, exports, picking, bounds, and face
  normals unchanged; and
* numeric tests cover selector matching and visual regressions demonstrate no seams,
  camera-space swimming, or confusion between raised and recessed patterns.

#### Reference-Image Scope Calibration (2026-09-19)

User-supplied photos were reviewed as visual-design references only. They are not
source-backed mineral-data claims, must not be committed or redistributed without an
explicit licensing decision, and cannot promote a renderer profile by themselves.

**Feasible with the current face-local system:** fine, bounded striations and shallow
growth-layer cues can be represented by deterministic normal and roughness changes on
an already-selected convex face. Quartz prism striations are the intended restrained
case: close, reflection-led bands perpendicular to the c-axis, with clean termination
faces. Fluorite `{100}` growth steps may use the same mechanism as a typical,
non-specimen-measured cue. Neither effect may add separate solids, deep occlusion,
or alter the silhouette.

**Requires later research or a separate design:** anatase photos show strong,
face-bounded parallel striations and a dark, highly specular appearance. The former
is technically compatible with face-local shading, but remains a candidate until its
pyramidal form, crystallographic direction, growth-face origin, and representative
scope are verified. The latter is visual reference only: review anatase's reported
adamantine/splendent/metallic luster and define a curated material mapping before
changing its appearance presets. Do not infer either rule from a photograph.

The reviewed fluorite overgrowth and quartz window/fenster examples instead have
visible child crystals, nested or recessed frames, self-occlusion, and often altered
transmission paths. These require a procedural display-growth mesh and belong to SR10.
Likewise, a fluorite treatment that shows literal terraces rather than SR9's shallow
shading cue belongs to SR10.

### SR10 — Procedural Display Growth Morphologies

**Status:** deferred for implementation; the architectural direction is accepted in
[ADR 0014](decisions/0014-procedural-display-growth-morphology.md). Skeleton, hopper,
window/fenster, literal stepped faces, and comparable growth forms are not surface
textures. They require render-only procedural mesh generation. Their resulting geometry
may be non-convex, but non-convexity is not the defining scope boundary: a visibly
terraced fluorite face also belongs here.

Implement SR10 through a separate display-only growth-morphology layer that derives a
render mesh from, but never modifies, the **idealized core mesh**. The selected
`HabitPreset` determines that core mesh before display-mesh construction; it is not
itself display geometry. The idealized core mesh is the authoritative scientific
geometry and is rendered directly in the default morphology mode. The optional
**display-growth mode** renders the derived mesh. The display layer must provide
explicit provenance, terminology, and a mode/label that makes its approximation clear.
It may reuse the current appearance, lighting, transmission, camera, and global
surface-detail controls, but existing face-local `surfaceProfiles` must not
automatically apply: the layer needs an explicit mapping from every display feature to
its originating core face for material routing, inspection, and picking. Do not use
normal mapping, or add constraints to the core's convex half-space construction, to
imitate literal terraces, skeleton quartz, or fenster geometry.

The first implementation slice is a fluorite `{100}` procedural display mesh with
recessed, nested square hopper terraces. It is a curated visualization interpretation
of the reviewed natural-growth observation, not a reconstruction or measurement of a
specimen. Every component that represents a solid must be closed and watertight; the
layer may contain multiple such components so later twins, child crystals, and
window/fenster forms are not constrained to a single mesh. A hit on display geometry
resolves only to the originating idealized core face; display features do not add a
public inspection identity. The existing cube-form selector `a` identifies the initial
fluorite `{100}` faces under the current selector contract.

Use collector-friendly labels and search aliases without making them scientific
categories or evidence claims. The initial display label is **Terraced fluorite**, with
**hopper-style** and **stepped cubic growth** as descriptive terms. A later quartz
display preset may be labelled **Fenster (window) quartz**, with **skeletal quartz** and
**window quartz** as aliases; **elestial** remains a search synonym only because its
usage is inconsistent.

The user-supplied fluorite overgrowth and quartz fenster references reviewed on
2026-09-19 illustrate this boundary. Treat their child-crystal growth and nested
windows as visual-design references for this display-only layer, not as source-backed
mineral-data claims or SR9 shader targets. Do not commit or redistribute the images
without their owner's explicit licensing decision.

This phase still requires implementation-level design for procedural mesh generation,
display-mode state and API, exports, and validation. Any export of display geometry must
be explicitly selected and labelled; default scientific exports continue to use the
idealized core mesh.

Acceptance:

* default morphology mode continues to render and export only the idealized core mesh;
* display-growth mode leaves the idealized core mesh, its bounds, normals,
  contributors, scientific picking result, and default export unchanged;
* every solid display component is closed and watertight, and repeated rendering from
  the same state regenerates identical display geometry and core-face attribution;
* every display triangle maps to an originating idealized core face, and picking exposes
  that face without a display-feature inspection identity;
* the initial fluorite display mesh affects only cube-form `a` / `{100}` faces and is
  identified as a curated typical interpretation rather than a specimen measurement;
* no existing `surfaceProfiles` are inferred or applied to display geometry without an
  explicit reviewed mapping;
* display geometry has deterministic resource replacement and disposal behavior; and
* any display-geometry export is explicitly requested and labelled as a display
  approximation.

## Cross-Cutting Test Matrix

At minimum, test:

* face selector and contributor precedence;
* tangent construction for cubic, trigonal/hexagonal-setting, monoclinic, and triclinic
  examples;
* stable procedural seeds and state restoration;
* geometry immutability;
* shader fallback when no surface profile exists;
* context loss, material disposal, and mineral replacement;
* transparent, metallic, and opaque rendering paths;
* display-growth watertightness, deterministic regeneration, display-triangle to
  core-face attribution, core-mesh immutability, and display-resource disposal; and
* visual regression scenes under a pinned renderer, environment, camera, exposure,
  and output color space.

Pixel comparisons are supporting evidence, not the sole correctness test. Scientific
direction and face selection require numeric tests independent of raster output.

### Human Visual Review Workflow

Prefer reproducible browser demos and targeted review directions over loading captured
images into the implementation session. When a visual decision needs human judgment,
provide the reviewer with the exact demo URL or command, fixed scene settings, and a
short checklist of what to compare. The reviewer records confirmation or requested
changes; that confirmation becomes the primary visual-review evidence.

Use automated capture and byte or pixel comparisons for determinism and regression
checks without inspecting the image contents conversationally. Load images for direct
assistant inspection only when the reviewer requests it, when an automated check reports
an unexplained difference, or when reproducing a visual defect requires it. This keeps
visual verification efficient while preserving the automated and scientific acceptance
gates.

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
* representation, interaction, and export of procedural display growth morphology; and
* whether advanced anisotropic optics warrants a separate milestone.

Adopt durable choices through the normal architecture or decision-record process.

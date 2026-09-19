# Crystal Viewer — Viewer API

Embedding, controls, lifecycle, events, inspection, and state behavior. Platform and package choices live in [architecture](architecture.md).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Morphology Controls

Morphology controls must operate on crystallographic forms.

Example:

```text
Quartz

Prism m                ───────●──
Rhombohedron r         ─────●────
Rhombohedron z         ───●──────
Steep rhombohedra      ──●───────
```

Changing a slider updates the corresponding development value, which is mapped to a support distance as specified in [Half-Space Intersection](scientific-model.md#half-space-intersection). A value of zero omits the form.

The crystal geometry is then regenerated.

This ensures the resulting crystal remains crystallographically meaningful.

`getForms()` reports each control's current `effect`: `inactive` (disabled or
zero), `scale-only` (the only active form, so changing it rescales the whole
shape), `shape` (a visible contributor among multiple active forms),
`redundant` (active but currently excluded by a tighter boundary), or
`geometry-invalid`. It also reports `contributesToVisibleFaces`. These values
are derived from the generic geometry constraints and contributors, so hosts
can explain or de-emphasize controls without mineral-specific rules. A
redundant form can become shape-affecting after further edits.

---

## Appearance Controls

Appearance controls operate on the [mineral appearance](data-model.md#mineral-appearance) fields and never modify scientific geometry. A loaded mineral exposes its curated appearance presets; the host selects one and may override individual fields. Selecting a preset clears prior overrides, mirroring the morphology habit/forms pattern. The effective appearance (preset merged with overrides) is applied to the rendered material in place, without regenerating geometry.

Each preset may carry a categorical `luster` classification (`vitreous`, `pearly`, `metallic`, or `dull`) that selects a curated renderer profile — primarily sheen for pearly surfaces. `luster` is part of the preset, not a user-overridable field, and does not enter serialized state independently; it is resolved through the selected preset. Explicit numeric overrides (roughness, metalness, transmission, IOR, absorption) always take precedence over the category profile. `getAppearance` reports the effective resolved appearance including the luster category and derived sheen values.

The API exposes `getAppearances`, `getAppearanceId`, `getAppearance`, `setAppearance`, and `setAppearanceField`. State serialization covers the selected appearance and user overrides under [Persistent State Coverage](#persistent-state-coverage). Changes emit `appearance-changed` so host controls stay synchronized, including after programmatic changes and state restoration.

Volumetric absorption is scale-invariant: the renderer derives `attenuationDistance`
from the geometry `thickness` so the Beer-Lambert exponent depends only on
`absorptionDensity`, not on absolute model scale. Opaque and metallic surfaces bypass
the transmission pass entirely. The renderer uses a scalar IOR and screen-space
transmission; it does not simulate dispersion or calcite birefringence. The
transmission approximation and limitations are recorded in
[ADR 0009](decisions/0009-transmission-and-optical-refinement.md).

`getSurfaceProfiles` reports each reviewed, documented-typical surface profile, its
claim ID and description, plus the number of currently matched faces. A match indicates
an eligible typical rendering treatment, not a measurement of the displayed specimen.
Profiles resolve from the selected mineral and current generated faces; they are not an
independent serialized state field.

### Generic Surface Detail

`getSurfaceDetail` and `setSurfaceDetail(enabled, strength)` control an optional generic
artistic naturalization layer. Strength is constrained to `[0, 1]`; the default is off
with a retained default strength of `0.35`. The effect adds low-amplitude normal and
roughness variation plus restrained grazing-angle edge response. It does not displace
geometry and must not be presented as a measured or mineral-specific feature. Changes
emit `surface-detail-changed`.

The enabled flag and strength are serialized as the optional `surfaceDetail` member of
version-1 state. States written before SR4 omit the member and restore with detail off.
The procedural realization is derived from stable mineral, habit, appearance, and face
identifiers; camera and model motion do not reseed it.

Face selection uses a translucent front-side tint that does not write depth. The
highlight preserves the underlying material's depth cues—particularly for transmissive
crystals—and never changes the camera, projection, geometry, or picked contributor.

### Reduced-Motion and High-Frequency Effects

The viewer honors the `prefers-reduced-motion: reduce` user setting. The only continuous
motion the viewer produces is the optional `start()` auto-rotation; when reduced-motion is
active that rotation is suppressed, so high-frequency surface detail such as striations
does not sweep across the screen. The static surface detail itself remains visible: it is
reviewed typical information, not motion, and on-demand interaction still renders through
`renderOnce`. The detection reads `matchMedia` once and is safe outside a browser (returns
inactive). Hosts that drive their own animation are responsible for honoring the same
preference for motion they introduce.

---

## Viewer API

### Web Component

The viewer is delivered as a framework-agnostic Web Component. Users integrate it into React, Vue, Svelte, Electron, Tauri, or any other browser-based environment by wrapping the component themselves; no framework-specific wrapper packages are provided.

The component must support plain-HTML embedding and multiple independent instances on one page. Changes to one instance must not change another's configuration, selection, or lifecycle. The public lifecycle and state-restoration contracts apply through the component.

The component is exported from `@crystal/viewer/component` as `CrystalViewerElement` and registered with `defineCrystalViewerElement()`, which defines the `<crystal-viewer>` custom element. The `mineral` attribute loads a bundled mineral on connection and on subsequent attribute changes. The component exposes the underlying `CrystalViewer` via `getViewer()`, and dispatches a `viewer-ready` event on connection.

### Quartz Variant Selection

Users must be able to select and inspect the supported [quartz handedness variants](data-model.md#quartz-handedness). Expose the selected variant and its crystallographic identity through the viewer API, and demonstrate selection and inspection in the reference application. Variant identity is part of the structural definition covered by [Persistent State Coverage](#persistent-state-coverage).

### Programmatic API

The viewer should expose a small framework-independent API. All API examples in this document are pseudocode illustrating intent, not final signatures. The API will be designed when the plan is stable.

Example:

```ts
const viewer = new CrystalViewer({
    canvas: document.querySelector("canvas")
});

await viewer.loadMineral("quartz");

viewer.setHabit("tessin");

viewer.setFormDevelopment("m", 0.75);

viewer.showAxes(true);

viewer.showFaceLabels(false);
```

The viewer must not create application UI controls automatically.

The [reference demos](spec.md#reference-viewer) own their HTML controls. They initialize those controls from current viewer state and keep them synchronized through API results and events, including after programmatic changes and state restoration.

### Environment Lighting

The viewer provides renderer-level controls for image-based lighting without adding
environment data to mineral appearance or scientific geometry. `loadEnvironment`
accepts an in-memory Radiance RGBE (`hdr`) or OpenEXR (`exr`) panorama, validates its
decoded dimensions, converts it to a PMREM environment, and commits it only after
decoding and conversion succeed. `loadHdrEnvironment` and `loadExrEnvironment` are
format-specific conveniences.
Replacing, resetting, or disposing the viewer releases the previous source texture
and PMREM render target.

The built-in default is a project-owned, procedurally generated neutral studio
panorama with broad warm key, cool fill, and narrow rim reflection shapes. It has no
runtime download or third-party asset terms. The default presentation uses environment
intensity `1`, identity rotation, visible background at zoom `1`, AgX tone mapping,
and exposure `1.15`. `resetEnvironment` restores the generated panorama without
overwriting the host's separately selected intensity, rotation, background, tone
mapping, or exposure controls.

Hosts may control environment intensity and yaw/pitch/roll rotation, background visibility, tone
mapping (`none`, `agx`, or `aces-filmic`), and exposure. Environment lighting and the
visible background remain independent so a neutral background can be retained for
scientific readability.

`setEnvironmentBackgroundZoom` changes only the visible panorama composition. A
value of `1` is the identity projection; values above `1` magnify the background and
values below `1` widen it. The implementation renders the background with a separate
camera field of view, leaving the crystal camera, picking, and image-based lighting
unchanged. Background zoom is session-only presentation state.

The environment's identity orientation is yaw `0`, pitch `0`, roll `0`. Equirectangular
HDR and EXR files standardize the projection but do not provide a universal semantic
"front of room" direction; hosts therefore expose yaw for choosing the front and
pitch/roll for correcting a tilted source panorama. The same rotation is applied to
lighting and to the background when it is visible.

`rotateModel` applies relative rotation about the viewer's X, Y, and Z axes. Pointer
dragging covers X and Y; host applications may map keyboard or other controls to all
three axes. The HDRI demo uses arrow keys for X/Y, Q/E for roll, Shift for fine steps,
and Home to restore the preferred view. Keyboard handling remains host-owned and is
active only while the canvas has focus.

Uploaded HDR bytes and presentation controls are intentionally session-only and are
not part of serialized viewer state. A future serializable environment contract must
use a resolvable packaged asset identity rather than embedding a local upload.

The [M5 HDRI demo variant](../packages/crystal-demo/minerals-hdri.html) demonstrates
bounded local `.hdr` and `.exr` uploads (128 MB encoded-file limit and 32-megapixel
decoded-image limit) and the renderer controls while preserving the original M5
acceptance demo.

---

## Viewer Lifecycle

The public viewer API should include functions such as:

```ts
viewer.resize(width, height);

viewer.render();

viewer.resetCamera();

viewer.dispose();
```

If an animation loop is used:

```ts
viewer.start();

viewer.stop();
```

The host application must be able to control the lifecycle explicitly.

### Camera and Preferred Views

A habit's optional [preferred view](data-model.md#habit-preset) supplies initial or reset-camera presentation metadata. When no restored or explicitly supplied camera state exists, initial framing uses the current habit's preferred view. `resetCamera()` also uses that preferred view and frames the current geometry bounds.

Changing habit or form settings preserves the user's current camera unless the host explicitly requests a reset. Restored camera state takes precedence over a preferred view. V1 records its supported `"perspective"` projection, position, up vector, target, zoom, clipping planes, and model rotation. Preferred-view metadata is not serialized separately from its referenced habit; the effective camera state is serialized under [Persistent State Coverage](#persistent-state-coverage).

### Mineral Loading

Mineral loading is transactional: resolve and validate the requested definition before replacing the current configuration. A failed load leaves the current viewer configuration and displayed geometry unchanged and exposes a diagnostic to the host.

Structural loading follows the same commit boundary. A CIF that parses but fails lattice, symmetry, atom-expansion, or supplied-bond validation emits `structure-load-failed`; it does not emit `structure-loaded`, replace the current definition, or supersede a pending mineral load.

When loads overlap, only the newest request may commit. Superseded results must not mutate viewer state or emit success events, even if they complete after the newest request fails. The host observes load completion, failure, and supersession through the `mineral-loaded`, `mineral-load-failed`, and `load-superseded` events; `loadMineral` is async and commits only the newest request.

When committing a different mineral or structural definition, clear the previous definition's morphology mesh. A successfully loaded definition whose requested morphology produces invalid geometry is accepted, shows no morphology mesh, and exposes the geometry diagnostic. This differs from a load rejected for invalid input. Retaining a stale mesh during morphology edits applies within the same loaded definition, as described below. State restoration follows its separate [transactional restoration contract](#transactional-restoration).

### Connection and Disposal

On Web Component disconnection, pause rendering and detach external listeners while preserving configuration. On reconnection, restore listeners and resume the previous rendering mode; a previously stopped viewer remains stopped. Repeated connection cycles must not create duplicate listeners or rendering loops.

Disposal permanently releases viewer-owned resources, detaches listeners, stops rendering, and invalidates pending work so its completion cannot mutate state or emit success events. Repeated disposal is harmless. Subsequent mutating calls report that the viewer is disposed (`viewer.lifecycle.disposed`), and reconnecting a disposed component does not reactivate it.

### Invalid Geometry and Recovery

When requested form settings produce an invalid geometry result ([Geometry Output](scientific-model.md#geometry-output)), the viewer must:

* retain the requested settings so the user can continue editing toward a valid combination;
* retain the last valid mesh from the same loaded definition, if one exists, and expose that it represents previous valid settings rather than the current request; mineral switches follow [Mineral Loading](#mineral-loading), while restoration follows [Transactional Restoration](#transactional-restoration);
* emit `geometry-invalid` with the diagnostic;
* show no crystal mesh if no valid mesh exists yet.

The viewer must expose the current geometry status and distinguish requested settings from the settings associated with the displayed mesh. Serialized form settings represent the requested settings, including when they are currently invalid. The host application is responsible for visibly identifying a retained mesh as stale and displaying the diagnostic; the viewer does not create application UI controls. The reference application must demonstrate this behavior.

On the next valid result, replace the displayed mesh, clear the invalid/stale status, and emit `geometry-changed`. An invalid edit does not emit `geometry-changed` for an unchanged retained mesh.

---

## Events

Use events rather than framework callbacks.

Events emitted by the stabilized viewer:

```text
mineral-loaded
mineral-load-failed
load-superseded
structure-loaded
structure-load-failed
habit-changed
variant-changed
form-changed
appearance-changed
geometry-changed
geometry-invalid
view-mode-changed
lattice-repetition-changed
face-selected
state-restored
state-rejected
viewer-ready   (Web Component connection)
```

`geometry-invalid` is required for failed geometry generation. Its detail contains the invalid result's complete [diagnostic](architecture.md#diagnostics) ([Geometry Output](scientific-model.md#geometry-output)). Recovery follows [Viewer Lifecycle](#viewer-lifecycle).

Viewer loading, lifecycle, and state operations use stable `viewer.*` diagnostic codes. Expected asynchronous failures reject with a typed public-operation error (`ViewerOperationError`) carrying one or more diagnostics; hosts must not parse exception messages to determine behavior. Exact types and signatures live in [crystal-viewer](../packages/crystal-viewer/src/index.ts).

Example:

```ts
viewer.addEventListener("face-selected", event => {
    console.log(event.detail);
});
```

Example payload:

```ts
{
    mineralId: "quartz",
    contributors: [
        { formId: "r", indices: [1, 0, -1, 1], operationIds: ["op-r-1"] }
    ],
    faceIndex: 7
}
```

---

## Picking and Face Inspection

Three.js raycasting may be used for interaction.

Every rendered polygon must retain all contributors defined by the [geometry provenance contract](scientific-model.md#geometry-output). Face inspection and selection payloads must expose the contributing forms with indices and operation IDs grouped by form. If a convenience primary form is exposed, its selection must be deterministic and the full contributor list must remain available.

When a user selects a face, it should be possible to display:

```text
Form name
Miller indices
Miller-Bravais indices
Face normal
Symmetry relationship
Equivalent faces
```

Display and event payloads report crystallographic indices in the loaded definition's declared setting. Any convenience representation in another setting must be identified as converted rather than replacing the declared-setting indices.

Provide a function to highlight all symmetry-equivalent faces.

For a face shared by multiple forms, equivalent-face highlighting must support selecting which contributing form's equivalence set to highlight. Use current contributor metadata after every regeneration, including when attribution changes without a change in vertex positions.

---

## Crystallographic Axes

Support optional display of crystallographic axes, derived from the actual lattice vectors rather than decorative XYZ axes. The axes shown depend on the crystal system and setting:

```text
Triclinic, monoclinic, orthorhombic:  a, b, c
Tetragonal:                           a (= b), c
Cubic:                                a (= b = c)
Hexagonal:                            a1, a2, a3, c
Trigonal (hexagonal setting):         a1, a2, a3, c
Trigonal (rhombohedral setting):      a1, a2, a3
```

---

## Unit Cell Visualization

Provide an optional unit-cell overlay.

Display:

* unit-cell edges
* lattice vectors
* crystallographic axes
* cell dimensions
* cell angles

The unit cell should remain correctly oriented relative to the external crystal.

---

## CIF Morphology

`loadCifMorphology(text, options?)` imports a selected CIF block and switches the
viewer to morphology mode. When the definition contains experimental crystal-face
measurements, the viewer calls the explicit-face core generator; the reported oriented
planes and perpendicular distances are used without symmetry expansion.

When measurements are absent, the viewer generates the documented
[simplified BFDH-style fallback](scientific-model.md#simplified-bfdh-style-fallback)
from the cell and resolved point symmetry. Successful fallback returns and emits the
warning `viewer.morphology.bfdh-fallback`. Hosts must display that warning so users can
distinguish a theoretical approximation from measured faces. Invalid or non-enclosing
plane sets emit `geometry-invalid` and do not commit geometry.

The dedicated [CIF morphology demo](../packages/crystal-demo/cif-morphology.html)
accepts a local CIF, reports diagnostics and preserved publication metadata, and does
not render atoms. The imported definition remains available for inspection, while the
displayed mode is morphology.

---

## Atomic Structure Mode

V1 supports the following separate modes according to the [product scope](spec.md#v1-checklist):

```text
Morphology View
Atomic Structure View
```

Atomic structure rendering should support:

```text
atoms
bonds
unit cells
repeated lattice cells
```

Use instanced rendering for atoms where appropriate.

Morphology View supports optional crystallographic axes and a unit-cell overlay. Atomic Structure View supports atoms, available bonds, and repeated cells. Both views must preserve consistent crystallographic orientation; displaying an atomic lattice inside the external morphology is deferred to the combined view below.

---

## Combined Structure / Morphology View

This mode is deferred beyond V1 under [Later Scope](spec.md#later-scope), with no delivery milestone assigned:

```text
transparent external crystal
+
atomic lattice inside
```

The user should be able to visually relate:

```text
macroscopic crystal faces
```

to:

```text
microscopic crystal structure
```

**Open decision — deferred beyond V1:** Before implementing this mode, define the relationship between morphology and atomic physical scales, lattice repetition limits, and clipping of atoms and bonds at the morphology boundary.

---

## State Serialization

Viewer state must be serializable as JSON-compatible data. Restoring state produced by the viewer must reproduce the requested scientific configuration and persistent viewing settings, provided referenced data is available and compatible. This guarantees equivalent configuration, not identical rendered pixels across environments.

Example:

```ts
const state = viewer.getState();
```

Partial illustration of state (not a complete restorable payload):

```json
{
    "mineral": "quartz",
    "habit": "tessin",

    "forms": {
        "m": 0.72,
        "r": 0.86,
        "z": 0.93
    },

    "display": {
        "axes": true,
        "labels": false,
        "wireframe": false
    }
}
```

Restoration:

```ts
viewer.setState(state);
```

This enables:

```text
save/load
shareable URLs
presets
undo/redo
external state managers
user-built wrappers
testing
```

Shareable URLs are a possible host capability, subject to payload size and data availability; serialization alone does not guarantee that a state fits in a URL.

### Persistent State Coverage

State must include the following configuration where the corresponding capability is supported:

| Category | Required coverage |
|---|---|
| Mineral or structural definition | Identity, declared setting, and data revision or compatibility identifier; imported definition as described below |
| Morphology | Effective form definitions or resolvable identities, enabled flags, development values, morphology scale, and supported preset overrides |
| Habit | Selected preset association alongside effective morphology settings |
| Appearance | Selected appearance and user overrides |
| Camera | Projection mode, position/orientation, target, and zoom or equivalent framing |
| Display | Persistent visibility settings, including axes, labels, unit cell, and wireframe |
| Atomic view | View mode and lattice repetition settings |

Saved effective settings take precedence over preset defaults during restoration. A habit ID alone is insufficient to reproduce an edited habit. Do not silently substitute changed defaults or incompatible referenced data.

Camera states created before target and zoom were added use the original target `[0, 0, 0]` and zoom `1`; new states always include both fields.

Transient state such as pointer hover, animation-loop handles, GPU resources, and face selection is excluded. Face selection is mesh-relative and not stable across regeneration, so it is not persistent; hosts re-apply it through the public selection API after geometry is regenerated. Exact state types live in [crystal-viewer](../packages/crystal-viewer/src/state.ts) (`ViewerState`, version 1); see the [state serialization decision](decisions/0004-viewer-state-serialization.md).

### Data Portability and Versions

Reference bundled minerals using their identity and data revision or compatibility identifier. Include the normalized structural definition for imported data, including its cell, symmetry, sites, applicable bonds, and preserved source metadata, so restoration does not depend on the original import session. Apply the [structural compatibility rules](data-model.md#atomic-structure). Any additional custom definitions needed to reproduce the configuration must also be included or resolve through compatible bundled data.

Caller-supplied mineral records are embedded as validated definitions alongside their identity and data revision. Bundled minerals remain compact references and must resolve to the recorded compatible revision. This makes a state created from `loadMineral(customRecord)` portable to a fresh viewer without adding custom records to the bundled catalog.

Every complete state payload must declare a state-format version. V1 ships `version: 1`; unsupported versions and incompatible data references produce explicit diagnostics rather than guessed substitutions. Referenced-data compatibility uses the mineral identity and data revision; imported definitions are embedded in full. See the [state serialization decision](decisions/0004-viewer-state-serialization.md) for version identifiers, the supported-version policy, and the compatibility mechanism.

### Transactional Restoration

Parse and validate the payload and resolve its required data before committing the restored configuration as one operation. Malformed state, unsupported versions, and unresolved or incompatible required references must reject restoration with a diagnostic and leave the previous viewer state unchanged. The host observes completion or rejection through the `state-restored` and `state-rejected` events; `setState` throws a `ViewerOperationError` on rejection.

A valid state whose form settings produce invalid geometry is accepted as a requested configuration and follows [Invalid Geometry and Recovery](#invalid-geometry-and-recovery). This is distinct from rejecting malformed or incompatible state.

Serialize requested settings, including invalid combinations, rather than a retained mesh or its previous valid settings. On restoration, regenerate geometry and derive status from the result. A freshly created viewer restoring an invalid request shows no mesh; an existing viewer may retain its previous valid mesh with stale status. The retained mesh is outside the round-trip guarantee.

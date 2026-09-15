# Parametric Mineral Crystal Viewer — Viewer API

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

---

## Viewer API

### Web Component

The viewer is delivered as a framework-agnostic Web Component. Users integrate it into React, Vue, Svelte, Electron, Tauri, or any other browser-based environment by wrapping the component themselves; no framework-specific wrapper packages are provided.

The component must support plain-HTML embedding and multiple independent instances on one page. Changes to one instance must not change another's configuration, selection, or lifecycle. The public lifecycle and state-restoration contracts apply through the component.

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

### Mineral Loading

Mineral loading is transactional: resolve and validate the requested definition before replacing the current configuration. A failed load leaves the current viewer configuration and displayed geometry unchanged and exposes a diagnostic to the host.

When loads overlap, only the newest request may commit. Superseded results must not mutate viewer state or emit success events, even if they complete after the newest request fails. The host must be able to observe load completion, failure, or supersession; exact signatures and event names remain deferred to M7.

When committing a different mineral or structural definition, clear the previous definition's morphology mesh. A successfully loaded definition whose requested morphology produces invalid geometry is accepted, shows no morphology mesh, and exposes the geometry diagnostic. This differs from a load rejected for invalid input. Retaining a stale mesh during morphology edits applies within the same loaded definition, as described below. State restoration follows its separate [transactional restoration contract](#transactional-restoration).

### Connection and Disposal

On Web Component disconnection, pause rendering and detach external listeners while preserving configuration. On reconnection, restore listeners and resume the previous rendering mode; a previously stopped viewer remains stopped. Repeated connection cycles must not create duplicate listeners or rendering loops.

Disposal permanently releases viewer-owned resources, detaches listeners, stops rendering, and invalidates pending work so its completion cannot mutate state or emit success events. Repeated disposal is harmless. Subsequent mutating calls report that the viewer is disposed, and reconnecting a disposed component does not reactivate it. Exact diagnostic signatures remain deferred to M7.

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

Possible events:

```text
face-hovered
face-selected
form-changed
habit-changed
geometry-changed
geometry-invalid
phase-changed
camera-changed
mineral-loaded
```

`geometry-invalid` is required for failed geometry generation. Its detail contains the invalid result's `reason`, `message`, and optional `formIds` ([Geometry Output](scientific-model.md#geometry-output)). Recovery follows [Viewer Lifecycle](viewer-api.md#viewer-lifecycle).

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
| Mineral or structural definition | Identity and data revision or compatibility identifier; imported definition as described below |
| Morphology | Effective form definitions or resolvable identities, enabled flags, development values, morphology scale, and supported preset overrides |
| Habit | Selected preset association alongside effective morphology settings |
| Appearance | Selected appearance and user overrides |
| Camera | Projection mode, position/orientation, target, and zoom or equivalent framing |
| Display | Persistent visibility settings, including axes, labels, unit cell, and wireframe |
| Atomic view | View mode and lattice repetition settings |

Saved effective settings take precedence over preset defaults during restoration. A habit ID alone is insufficient to reproduce an edited habit. Do not silently substitute changed defaults or incompatible referenced data.

Transient state such as pointer hover, animation-loop handles, and GPU resources is excluded. Exact state types and signatures remain deferred to M7.

> **Open decision — deferred to M7:** Decide whether face selection is persistent. If included, define stable identification and behavior when regeneration removes the selected face.

### Data Portability and Versions

Reference bundled minerals using their identity and data revision or compatibility identifier. Include the normalized structural definition for imported data, including its cell, symmetry, sites, applicable bonds, and preserved source metadata, so restoration does not depend on the original import session. Apply the [structural compatibility rules](data-model.md#atomic-structure). Any additional custom definitions needed to reproduce the configuration must also be included or resolve through compatible bundled data.

Every complete state payload must declare a state-format version. Unsupported versions and incompatible data references produce explicit diagnostics rather than guessed substitutions.

> **Open decision — deferred to M7:** Define version identifiers, supported versions, migration policy, and the mechanism for establishing referenced-data compatibility. Migrations, if supported, must preserve the round-trip guarantee.

### Transactional Restoration

Parse and validate the payload and resolve its required data before committing the restored configuration as one operation. Malformed state, unsupported versions, and unresolved or incompatible required references must reject restoration with a diagnostic and leave the previous viewer state unchanged. The host must be able to observe completion or rejection; exact API signatures are deferred to M7.

A valid state whose form settings produce invalid geometry is accepted as a requested configuration and follows [Invalid Geometry and Recovery](#invalid-geometry-and-recovery). This is distinct from rejecting malformed or incompatible state.

Serialize requested settings, including invalid combinations, rather than a retained mesh or its previous valid settings. On restoration, regenerate geometry and derive status from the result. A freshly created viewer restoring an invalid request shows no mesh; an existing viewer may retain its previous valid mesh with stale status. The retained mesh is outside the round-trip guarantee.

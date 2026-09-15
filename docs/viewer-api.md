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

### Invalid Geometry and Recovery

When requested form settings produce an invalid geometry result ([Geometry Output](scientific-model.md#geometry-output)), the viewer must:

* retain the requested settings so the user can continue editing toward a valid combination;
* retain the last valid mesh, if one exists, and expose that it represents previous valid settings rather than the current request;
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
    formId: "r",
    indices: [1, 0, -1, 1],
    faceIndex: 7
}
```

---

## Picking and Face Inspection

Three.js raycasting may be used for interaction.

Every rendered polygon must retain information about its crystallographic source.

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

The viewer supports the following modes according to the [product scope](spec.md#v1-checklist); combined view is an advanced capability described below:

```text
Morphology View
Atomic Structure View
Combined View
```

Atomic structure rendering should support:

```text
atoms
bonds
unit cells
repeated lattice cells
```

Use instanced rendering for atoms where appropriate.

---

## Combined Structure / Morphology View

A useful advanced mode:

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

This feature is secondary to the morphology engine.

---

## State Serialization

Viewer state should be serializable.

Example:

```ts
const state = viewer.getState();
```

Possible state:

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

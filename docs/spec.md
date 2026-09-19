# Crystal Viewer — Product Specification

Start here for product scope, capabilities, and non-goals. Detailed contracts have one authoritative home in the documents below.

## Document Map

| Document | Authoritative contents |
|---|---|
| [Product specification](spec.md) | Product scope, V1 checklist, capabilities, and non-goals |
| [Scientific model](scientific-model.md) | Coordinates, symmetry, geometry, physical models, and validation |
| [Data model](data-model.md) | Records, atomic expansion, periodic bonds, CIF import, and provenance |
| [Architecture](architecture.md) | Platform, packages, technical boundaries, and testing policy |
| [Viewer API](viewer-api.md) | Web Component, runtime behavior, events, and serialization |
| [Implementation plan](plan.md) | Milestones, dependencies, and acceptance criteria |
| [Decision records](decisions/README.md) | Significant technical choices and their rationale |

Design work beyond the completed V1 milestones is tracked in the
[surface-rendering implementation plan](surface-rendering-plan.md). A possible future,
separate-repository ingestion system is described in the non-binding
[surface-data automation draft](surface-data-automation-draft.md). These documents do
not expand the V1 checklist or override the owning contracts above.

## Reading and Status

The V1 checklist below controls release scope. The other documents define behavior within that scope; the plan sequences its delivery. Interfaces and API examples remain illustrative pseudocode, not final signatures or package ownership. Once implemented, exact signatures belong in code and generated API documentation.

Open decisions remain marked in their owning documents. A blocking decision prevents the named work from starting; a deferred detail may be resolved during its implementation milestone. Reorganization does not resolve the remaining data-model and API design questions.

## Project Goal

Build a framework-agnostic web-based 3D mineral crystal viewer.

The application must generate idealized crystal geometry procedurally from crystallographic and morphology parameters rather than relying on prebuilt 3D models.

## V1 Checklist

This is the authoritative V1 scope. Deliver it through milestones M1–M8 in the [implementation plan](plan.md#v1-milestones).

V1 must provide:

* mineral crystallography (all seven crystal systems, validated gradually — see [implementation sequence](plan.md#implementation-sequence))
* Miller and Miller-Bravais indices
* symmetry-equivalent faces
* procedural crystal morphology
* adjustable crystal forms
* at least five minerals, each with at least two documented named habits (see [habit completion requirements](data-model.md#completed-habit-presets) and [delivery coverage](plan.md#mineral-and-crystal-system-coverage))
* crystallographic axes and unit-cell display
* morphology sliders and face inspection
* serializable and restorable viewer state
* atomic structure visualization
* mineral appearance
* scientific references and data provenance
* a framework-independent core and a framework-agnostic Web Component
* Three.js used only for rendering, with no manually modeled crystal meshes

## Later Scope

Milestones M9–M10 ([later milestones](plan.md#later-milestones)) cover:

* twinning
* pressure and temperature effects where scientifically supported
* phase changes

Other future capabilities are described below; they are not additions to the V1 checklist.

[Combined Structure / Morphology View](viewer-api.md#combined-structure--morphology-view) is deferred beyond V1, with no delivery milestone assigned. V1 provides separate morphology and atomic structure views, with consistent crystallographic orientation and optional axes and unit-cell display.

An expanded mineral catalog and any database, indexing, or search infrastructure needed to support it are also later scope. V1 ships the small curated set in the [Initial Minerals](#initial-minerals) section as version-controlled project data.

## Implemented Additions Beyond V1

The following capabilities were added after completion of the V1 checklist. They do
not retroactively change M1–M8 acceptance:

* import measured external faces from the CIF `_exptl_crystal_face_*` category and
  generate morphology from their Miller indices and perpendicular distances;
* when those measurements are absent, show a bounded, explicitly identified
  simplified BFDH-style morphology based on low-index planes and interplanar spacing;
* load local Radiance `.hdr` and OpenEXR `.exr` panoramas for image-based lighting;
* control environment intensity, three-axis orientation, tone mapping, exposure,
  background visibility, and background-only zoom; and
* rotate the crystal around all three axes through pointer and host-owned keyboard
  controls.

The scientific contracts and limitations for measured and theoretical CIF morphology
are defined in [CIF-Derived Morphology](scientific-model.md#cif-derived-morphology).
Environment behavior is defined in [Environment Lighting](viewer-api.md#environment-lighting).

---

## Supported Crystal Systems

Support all seven crystal systems:

```text
Triclinic
Monoclinic
Orthorhombic
Tetragonal
Trigonal
Hexagonal
Cubic
```

The implementation sequence is defined in [implementation sequence](plan.md#implementation-sequence).

---

## Initial Minerals

Do not begin with thousands of minerals.

Recommended first set:

```text
Quartz
Calcite
Fluorite
Pyrite
Anatase
```

Later expand with:

```text
Rutile
Beryl
Garnet
Corundum
Zircon
```

This selection provides useful variation in:

* crystal systems
* habit complexity
* symmetry
* common forms
* educational value

---

## Initial Rendering Quality

Prioritize:

```text
clear face geometry
correct lighting
accurate transparency
good edge visibility
smooth interaction
```

Do not prioritize photorealistic inclusions or defects during early development.

---

## Surface Detail

Possible later procedural effects:

```text
growth striations
etched surfaces
minor roughness
fractures
internal inclusions
zoning
surface coatings
small chips
```

These must be separate from the crystallographic base geometry.

Do not alter the scientific geometry in order to simulate cosmetic imperfections.

---

## Export

Because geometry generation is renderer-neutral, future export should support:

```text
OBJ
STL
GLTF / GLB
JSON crystal parameters
SVG projections
PNG rendering
```

Export functionality should use generated geometry rather than accessing Three.js internals where possible.

---

## Reference Viewer

Create a lightweight plain-DOM application for development, using plain HTML, CSS, and JavaScript/TypeScript. Add minimal demos incrementally as soon as a capability becomes viewable; do not postpone all demos until API stabilization in M7. Each milestone demo remains independently runnable and is linked from a simple demo index.

Each demo should be a small HTML document focused on one capability and use the exported viewer boundary rather than renderer internals. A demo may use a clearly provisional viewer API before M7, then must be updated to the stabilized API during M7. Do not copy scientific calculations, mineral definitions, or manually modeled geometry into a demo.

Controls must reflect the viewer's current requested settings. Initialize controls from viewer state, display current slider values and selections, send edits through the viewer API, and listen for viewer events so programmatic changes and state restoration update the controls. Display current geometry or loading diagnostics where applicable.

The V1 suite must include basic embedding, morphology controls, programmatic controls and events, multiple minerals, atomic structure, and appearance examples as those capabilities are delivered. Demonstrate two independent viewer instances on one page in at least one demo.

Suggested layout:

```text
-----------------------------------------------------
 Mineral                            Crystal System
 Quartz                             Trigonal

 Habit
 [ Tessin ▼ ]

 Forms
 m  ─────────●──
 r  ──────●─────
 z  ────────●───

 [x] Axes
 [ ] Miller indices
 [ ] Unit cell
 [ ] Atomic structure

                 3D VIEW
-----------------------------------------------------
```

This is a reference/testing interface, not a permanent framework choice.

---

## Important Scientific Limitation

A unit-cell or structural CIF definition determines crystallographic data (system,
unit cell, symmetry, atomic structure, valid planes, and interfacial angles), but does
not by itself determine external morphology (which forms are present, relative
development, named habit, growth asymmetry, impurity effects, or imperfections). A CIF
defines reported external morphology only when it explicitly contains the supported
experimental crystal-face measurements. The BFDH-style fallback derived from cell and
symmetry data is a theoretical geometric approximation, not reported habit data. This
distinction is stated in [Morphology Data Model](data-model.md#morphology-data-model),
[CIF Support](data-model.md#cif-support), and
[CIF-Derived Morphology](scientific-model.md#cif-derived-morphology) and must remain
explicit throughout the project.

---

## Non-Goals for Initial Version

Do not attempt initially:

```text
photorealistic geological specimens
arbitrary fracture simulation
automatic prediction of habit from P/T
fluid-growth simulation
full thermodynamic mineral modeling
all known mineral species
all known twin laws
native mobile applications
complex application framework
```

These can be considered later.

---

## Core Design Rule

The central rule of the project is:

> Generate scientifically valid ideal crystal geometry from crystallographic planes and morphology parameters. Keep scientific geometry independent from visualization, UI, and cosmetic appearance.

# Parametric Mineral Crystal Viewer — Product Specification

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
* at least five minerals, each with multiple documented named habits
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

Create a lightweight plain-DOM application for development, using plain HTML, CSS, and JavaScript/TypeScript. The repo should include multiple minimal demos showing how to embed the Web Component in barebone HTML without any framework.

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

A CIF or unit-cell definition determines crystallographic data (system, unit cell, symmetry, atomic structure, valid planes, interfacial angles) but does not determine external morphology (which forms are present, relative development, named habit, growth asymmetry, impurity effects, imperfections). This distinction is stated in [Morphology Data Model](data-model.md#morphology-data-model), [CIF Support](data-model.md#cif-support), and [Pressure and Temperature](scientific-model.md#pressure-and-temperature) and must remain explicit throughout the project.

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

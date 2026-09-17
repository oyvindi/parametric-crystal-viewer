# Crystal Viewer

A framework-agnostic web-based 3D mineral crystal viewer. It generates idealized
crystal geometry procedurally from crystallographic and morphology parameters —
no prebuilt 3D meshes. [Three.js](https://threejs.org/) is used only for rendering;
all scientific calculations live in a renderer-neutral core.

## Capabilities (V1)

* All seven crystal systems (triclinic, monoclinic, orthorhombic, tetragonal,
  trigonal, hexagonal, cubic)
* Miller and Miller-Bravais indices
* Symmetry-equivalent faces
* Procedural crystal morphology with adjustable forms and morphology sliders
* Nine shipped minerals, each with at least two documented named habits
* Crystallographic axes and unit-cell display
* Morphology sliders and face inspection (picking, equivalent-face highlighting)
* Serializable and restorable viewer state
* Atomic structure visualization (CIF import, symmetry expansion, periodic bonds)
* Mineral appearance — physically based rendering with transmission, IOR, and
  colored absorption
* Scientific references and data provenance for all curated data
* Framework-independent core and a framework-agnostic Web Component
* Three.js used only for rendering, with no manually modeled crystal meshes

## Shipped Minerals

| Mineral | Crystal system | Habits | Variants | Appearance presets |
|---|---|---:|---:|---:|
| Fluorite | Cubic | 3 | — | 3 |
| Quartz | Trigonal | 4 | 2 (left/right) | 5 |
| Calcite | Trigonal | 2 | — | — |
| Pyrite | Cubic | 2 | — | 2 |
| Anatase | Tetragonal | 2 | — | — |
| Albite | Triclinic | 2 | — | 1 |
| Gypsum | Monoclinic | 2 | — | 2 |
| Forsterite | Orthorhombic | 2 | — | 2 |
| Beryl | Hexagonal | 2 | — | 3 |

Records and provenance are version-controlled project data under `crystal-data`.

## Quick Start

```sh
npm install
npm run build
npm test
npm run serve          # serves demos at http://localhost:5173
```

Open `http://localhost:5173/packages/crystal-demo/` for the demo index, or go
straight to a demo:

* [Basic Embedding](packages/crystal-demo/basic-embedding.html) — two independent viewer instances
* [Fluorite](packages/crystal-demo/fluorite.html) — morphology sliders and habit selection
* [Quartz](packages/crystal-demo/quartz.html) — handedness, face inspection, Miller-Bravais
* [Minerals](packages/crystal-demo/minerals.html) — multi-mineral catalog
* [Atomic Structure](packages/crystal-demo/structure.html) — CIF import, bonds, lattice repetition
* [Appearance](packages/crystal-demo/appearance.html) — PBR material controls
* [Controls & Events](packages/crystal-demo/controls.html) — programmatic API and state save/restore

## Packages

```text
crystal-data   → crystal-core
crystal-three  → crystal-core
crystal-viewer → crystal-core, crystal-data, crystal-three
crystal-demo   → crystal-viewer
```

| Package | Owns |
|---|---|
| `crystal-core` | Renderer-neutral crystallographic calculations: lattice, symmetry, Miller indices, half-space intersection, geometry output, atomic expansion, periodic bonds. No runtime dependencies. |
| `crystal-data` | Mineral and habit schemas, curated records, provenance, CIF 1.1 import, and conversion into core inputs. |
| `crystal-three` | Conversion of core geometry into Three.js `BufferGeometry`, PBR materials, atomic rendering, and unit-cell overlays. |
| `crystal-viewer` | `CrystalViewer` class, `<crystal-viewer>` Web Component, camera, picking, lifecycle, and state serialization. |
| `crystal-demo` | Plain-HTML reference demos using only the exported viewer boundary. |

## API

### CrystalViewer (`@crystal/viewer`)

Programmatic API. Exact types are in `packages/crystal-viewer/src/index.ts` and
emitted `dist/*.d.ts`; behavioral contracts are in [viewer-api.md](docs/viewer-api.md).

| Group | Methods |
|---|---|
| Loading | `loadMineral(source)`, `loadCif(text, options?)`, `loadStructure(definition)` |
| Morphology | `setHabit(id)`, `setVariant(id)`, `setFormDevelopment(formId, value)`, `setFormEnabled(formId, enabled)`, `setMorphologyScale(scale)` |
| Inspection | `selectFace(index)`, `clearSelection()`, `highlightEquivalentFaces(index)`, `getSelectedFace()`, `getAllFaces()`, `getEquivalentFaces(index)`, `showFaceLabels(show)` |
| Display | `setShowAxes(show)`, `setShowUnitCell(show)`, `setShowBonds(show)`, `setShowWireframe(show)` |
| Atomic | `setViewMode(mode)`, `setLatticeRepetition(na, nb, nc)`, `getStructureInfo()` |
| Appearance | `setAppearance(id)`, `setAppearanceField(field, value)` |
| State | `getState()`, `setState(state)` |
| Lifecycle | `start()`, `stop()`, `disconnect()`, `reconnect()`, `dispose()`, `resetCamera()`, `resize(w, h)`, `render()` |
| Catalog | `listMinerals()`, `getMineral(id)` (re-exported from `@crystal/data`) |

The viewer is an `EventTarget`. Events it dispatches:

| Event | Triggered when |
|---|---|
| `mineral-loaded` | A mineral load commits successfully |
| `mineral-load-failed` | A mineral load fails; current state preserved |
| `load-superseded` | A newer load request supersedes an older one |
| `habit-changed` | The active habit changes |
| `variant-changed` | The active variant changes |
| `form-changed` | A form's development or enabled state changes |
| `geometry-changed` | Geometry regenerates successfully |
| `geometry-invalid` | An edit produces invalid geometry; last valid mesh retained |
| `face-selected` | A face is picked or selection is cleared |
| `view-mode-changed` | The view mode switches between morphology and atomic |
| `lattice-repetition-changed` | The atomic lattice repetition changes |
| `appearance-changed` | The appearance preset or a field value changes |
| `structure-loaded` | A structural definition loads for atomic view |
| `structure-load-failed` | A structural definition fails to load |
| `state-restored` | `setState` commits successfully |
| `state-rejected` | `setState` rejects malformed or incompatible state without mutation |

### Web Component (`@crystal/viewer/component`)

```html
<script type="module">
  import { defineCrystalViewerElement } from "@crystal/viewer/component";
  defineCrystalViewerElement();
</script>
<crystal-viewer mineral="quartz" style="width:600px;height:400px"></crystal-viewer>
```

The `mineral` attribute loads a bundled mineral on connection. `getViewer()`
returns the underlying `CrystalViewer`; `dispose()` releases resources permanently.
Multiple independent instances on one page are supported.

### crystal-core

`generateCrystal(crystallography, morphology)` is the top-level pipeline: it
validates the unit cell, resolves symmetry (explicit operations or registry), and
generates convex crystal geometry via half-space intersection. `validateCrystallography`
checks inputs before generation. `expandAtomicStructure` and `inferBonds` support
atomic structure visualization. See the [package README](packages/crystal-core/README.md)
for the diagnostic code set.

### crystal-data

`createMineralCatalog()`, `listMinerals()`, and `getMineral(id)` provide the
curated catalog. `importCif(text, options?)` parses CIF 1.1 into a structural
definition. `validateMineral()` enforces the schema and provenance contract. See
the [package README](packages/crystal-data/README.md).

### crystal-three

`createThreeGeometry(geometry)` and `createThreeGeometryWithPicking(geometry)`
convert core geometry into Three.js `BufferGeometry`, recording the originating
core face index per triangle for picking. `applyAppearance(material, params)`
maps the seven V1 appearance fields to `MeshPhysicalMaterial`.
`createAtomicStructure(...)` builds instanced atom spheres, bond cylinders, and
unit-cell wireframes.

## Documentation

| Document | Contents |
|---|---|
| [spec.md](docs/spec.md) | Product scope, V1 checklist, capabilities, non-goals |
| [scientific-model.md](docs/scientific-model.md) | Coordinates, symmetry, geometry, physical models, validation |
| [data-model.md](docs/data-model.md) | Records, atomic expansion, bonds, CIF import, provenance |
| [architecture.md](docs/architecture.md) | Platform, packages, boundaries, testing policy |
| [viewer-api.md](docs/viewer-api.md) | Web Component, runtime behavior, events, serialization |
| [plan.md](docs/plan.md) | Milestones, dependencies, acceptance criteria |
| [decisions/](docs/decisions/README.md) | Technical decision records |

## Status

V1 (milestones M1–M8) is complete: geometry engine, nine minerals, atomic
structure, stabilized viewer API, and appearance. Twinning (M9) and
pressure/temperature effects (M10) are later scope.

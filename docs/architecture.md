# Parametric Mineral Crystal Viewer — Architecture

Platform choices, package boundaries, rendering integration, and cross-package testing policy. Product scope is defined in the [specification](spec.md#v1-checklist).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Technology Stack

The initial implementation should **not depend on React, Vue, Svelte, Angular, or another UI framework**.

The reference application uses plain HTML, CSS, and TypeScript.

Recommended initial stack:

```text
TypeScript
Three.js
WebGL 2
Vite
HTML
CSS
```

Possible future additions:

```text
WebGPU
WebAssembly
Rust/WASM
```

Do not make WebGPU or WASM requirements for the initial implementation.

Three.js should be used as the renderer.

Crystallographic calculations must not depend on Three.js.

---

## Architectural Principles

The viewer orchestrates data loading, scientific calculations, and rendering. Data normalization and rendering both depend on the renderer-neutral scientific core; the core does not depend on the mineral catalog. See [Package Dependencies and Ownership](#package-dependencies-and-ownership) for allowed imports.

The system must maintain strict separation between:

1. crystallographic mathematics
2. mineral data
3. geometry generation
4. rendering
5. user interface

The crystallographic engine must be usable without a browser or renderer.

---

## Package Structure

Recommended repository structure:

```text
packages/

    crystal-core/
        lattice mathematics
        reciprocal lattice
        symmetry
        Miller planes
        half-space intersection
        morphology generation
        twinning mathematics
        geometry output

    crystal-data/
        mineral schemas
        morphology schemas
        habit presets
        phase data
        physical-property data
        source references
        CIF parsing

    crystal-three/
        Three.js BufferGeometry conversion
        materials
        scene helpers
        face highlighting
        atomic rendering
        shaders

    crystal-viewer/
        high-level viewer API
        Web Component export
        camera
        controls
        picking
        events
        state serialization

    crystal-demo/
        plain HTML
        CSS
        JavaScript
        TypeScript
        multiple minimal demos
        development / reference interface
```

### Package Dependencies and Ownership

The following graph defines allowed direct imports between project packages. An arrow means "imports"; packages need not use every allowed dependency.

```text
crystal-data   → crystal-core
crystal-three  → crystal-core
crystal-viewer → crystal-core, crystal-data, crystal-three
crystal-demo   → crystal-viewer
```

| Package | Owns |
|---|---|
| `crystal-core` | Renderer-neutral scientific types, lattice mathematics, symmetry registry and resolution, geometry generation, atomic expansion, and periodic bond calculations |
| `crystal-data` | Mineral and habit schemas, curated records, provenance, CIF parsing, and conversion into core inputs using core validation and normalization calculations |
| `crystal-three` | Conversion of core geometry into Three.js objects, materials, and atomic rendering |
| `crystal-viewer` | Loading, orchestration, interaction, lifecycle, and state serialization |
| `crystal-demo` | Application controls, reference interface, and embedding demos |

`crystal-core` receives scientific inputs directly. It must not import the mineral catalog, interpret named habits, or depend on Three.js or browser APIs. Shared scientific types belong in core; no separate shared-types package is introduced initially. Exact types and signatures remain implementation decisions.

`crystal-data` interprets imported bond references and converts them into core inputs; core performs atomic expansion and periodic bond calculations. Rendering consumes the resulting scientific data without importing the mineral catalog.

The rationale is recorded in [Scientific Core Dependency Boundary](decisions/0001-scientific-core-dependency-boundary.md).

Monorepo tooling, package manager, build configuration, and module format will be determined during implementation based on what makes sense for the stack.

---

## Three.js Rendering Layer

`crystal-three` should convert generic crystal geometry into Three.js objects.

Example:

```ts
function createThreeGeometry(
    crystal: CrystalGeometry
): THREE.BufferGeometry;
```

The Three.js renderer should initially support:

```text
solid rendering
wireframe
transparent rendering
orthographic camera
perspective camera
lighting
face outlines
selection highlighting
```

---

## Testing

Add automated tests to the code for all packages. Use published crystallographic examples as test fixtures where applicable.

### Appearance Validation

Use documented quartz and fluorite reference scenes to validate transmission, IOR, roughness, color, and absorption. For each property, document the intended visible effect and scene conditions used to assess it. Appearance changes must preserve scientific geometry, following [Mineral Appearance](data-model.md#mineral-appearance).

Review face and edge readability during rotation and zoom. Record visual review results alongside automated checks for appearance parameter mapping and state restoration. These checks assess the required rendering behavior without requiring identical pixels across environments.

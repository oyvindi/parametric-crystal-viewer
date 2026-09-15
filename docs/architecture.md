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

The architecture is layered (see [Package Structure](architecture.md#package-structure) for the concrete package graph): viewer API on top of a Three.js rendering layer, on top of crystal geometry generation, on top of the crystallographic engine, on top of mineral/morphology data.

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

Dependencies should remain one-directional.

`crystal-core` must not import Three.js.

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

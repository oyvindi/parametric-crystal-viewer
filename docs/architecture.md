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
| `crystal-core` | Renderer-neutral scientific types, the shared diagnostic envelope, lattice mathematics, symmetry registry and resolution, geometry generation, atomic expansion, and periodic bond calculations |
| `crystal-data` | Mineral and habit schemas, curated records, provenance, CIF parsing, and conversion into core inputs using core validation and normalization calculations |
| `crystal-three` | Conversion of core geometry into Three.js objects, materials, and atomic rendering |
| `crystal-viewer` | Loading, orchestration, interaction, lifecycle, and state serialization |
| `crystal-demo` | Application controls, reference interface, and embedding demos |

`crystal-core` receives scientific inputs directly. It must not import the mineral catalog, interpret named habits, or depend on Three.js or browser APIs. Shared scientific types belong in core; no separate shared-types package is introduced initially. Exact types and signatures remain implementation decisions.

`crystal-data` interprets imported bond references and converts them into core inputs; core performs atomic expansion and periodic bond calculations. Rendering consumes the resulting scientific data without importing the mineral catalog.

Each `crystal-demo` page depends only on the exported `crystal-viewer` boundary. Demo controls own their HTML presentation and synchronize through viewer state and events; they must not duplicate scientific logic or reach into `crystal-core`, `crystal-data`, or `crystal-three` internals. Keep previously delivered milestone demos runnable when the viewer API evolves.

The rationale is recorded in [Scientific Core Dependency Boundary](decisions/0001-scientific-core-dependency-boundary.md).

Select and document the monorepo tooling, package manager, build configuration, module format, runtime targets, and test runner during the [M1 repository bootstrap](plan.md#m1--geometry-prototype), before scientific feature implementation begins. These choices remain implementation decisions until that gate, but must not remain unresolved after it.

### Repository Tooling

M1 uses npm workspaces (npm 11.19.0) with the `packages/*` workspace layout. The root `package.json` is the workspace manifest and records the required Node.js version: Node 22 or later. The repository currently uses Node 26.8.1.

Packages compile as native ECMAScript modules using TypeScript's `NodeNext` module and resolution modes, targeting ECMAScript 2022. The root TypeScript build uses project references to compile packages in dependency order. Each package emits its own declaration files and JavaScript under `dist/`; those artifacts are not committed.

The package manifests encode the allowed project dependency graph in [Package Dependencies and Ownership](#package-dependencies-and-ownership), using npm-compatible local `file:` references. No package may add another `@crystal/*` dependency unless that graph permits it.

Run `npm install` after cloning, `npm run build` to compile all packages, and `npm test` to run the test suite with Vitest. `crystal-core` has an explicit Vitest Node environment and its tests must continue to pass without browser globals. The root Vitest project configuration discovers package test configurations; later packages may add their own Node, browser, or integration projects without changing the core contract. `npm run check` verifies package dependency boundaries, builds all packages, then runs all tests. `npm run benchmark:m1` runs the reproducible geometry benchmark. `npm run serve` builds all packages and starts a zero-dependency static server for the browser demos (ES modules require HTTP, not `file://`). `node scripts/check-docs.mjs` checks local documentation links, anchors, and code fences. The [M1 acceptance audit](m1-acceptance.md) records clean-install evidence.

Until the development shell's `npm` launcher is repaired, invoke the installed npm CLI through Node directly: `node /home/oyvind/bin/node/lib/node_modules/npm/bin/npm-cli.js <command>`. This development shell requires Bash to launch Node: `/bin/sh` cannot execute the configured Node binary, so the repository scripts use `bash -lc` explicitly.

---

## Diagnostics

All packages use a renderer-neutral, JSON-compatible diagnostic envelope owned by `crystal-core`:

```ts
interface Diagnostic {
    code: string;
    severity: "warning" | "error";
    message: string;

    path?: string; // JSON Pointer into normalized input or state.

    mineralId?: string;
    formIds?: string[];
    operationIds?: string[];

    source?: {
        block?: string;
        line?: number;
        column?: number;
    };

    details?: Record<string, unknown>;
}
```

`code` is stable, machine-readable, and namespaced by owning package and operation, for example `core.geometry.unbounded` or `data.cif.unsupported-version`. Host code must branch on `code`, not `message`. Messages are concise human-readable explanations and may evolve without a compatibility change. Optional `details` remain JSON-compatible and must not be required to identify the diagnostic.

An error prevents the requested operation from committing. A warning reports preserved uncertainty, omitted optional data, or another non-fatal condition and accompanies a successful result. Return all diagnostics that can be determined safely in one validation pass, in deterministic order.

Expected failures from scientific input, imported data, loading, or state restoration use typed results or typed public-operation errors carrying one or more diagnostics. Reserve uncaught exceptions for programming defects or genuinely unexpected runtime failures. Each package defines and documents its own finite set of diagnostic codes while using this common envelope.

---

## Three.js Rendering Layer

`crystal-three` converts generic crystal geometry into Three.js objects. Three.js (`three`) is a runtime dependency of `crystal-three` and `crystal-viewer`.

Core geometry remains double precision under the [numeric policy](scientific-model.md#numeric-policy). This layer performs the explicit conversion to the `Float32Array` buffers used by Three.js and the GPU.

Core faces are ordered convex polygon loops. `crystal-three` triangulates them deterministically for rendering and records the originating core face index for every triangle so picking recovers the complete crystallographic contributor metadata.

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

The viewer's Node integration tests use real Three.js scenes, cameras, and geometry with a stubbed WebGL renderer. They exercise public loading and camera behavior without browser globals. Keep real-browser demo smoke checks as separate evidence; the M4 results are recorded in its [acceptance audit](m4-acceptance.md#verification).

### Appearance Validation

Use documented quartz, fluorite, and pyrite reference scenes to validate the V1 appearance fields defined in [Mineral Appearance](data-model.md#mineral-appearance). For each property, document the intended visible effect and scene conditions used to assess it. Appearance changes must preserve scientific geometry.

Review face and edge readability during rotation and zoom. Record visual review results alongside automated checks for appearance parameter mapping and state restoration. These checks assess the required rendering behavior without requiring identical pixels across environments.

The M8 results are recorded in the [M8 acceptance audit](m8-acceptance.md#reference-scene-visual-review): each V1 field's intended effect, the quartz/fluorite/pyrite reference scenes used, and the rotation/zoom readability outcome. Automated parameter-mapping and state-restoration checks live with the [crystal-three](../packages/crystal-three/src/appearance.test.ts) and [crystal-viewer](../packages/crystal-viewer/src/m8-acceptance.test.ts) tests.

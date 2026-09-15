# Parametric Mineral Crystal Viewer — Specification

# 1. Project Goal

Build a framework-agnostic web-based 3D mineral crystal viewer.

The application must generate idealized crystal geometry procedurally from crystallographic and morphology parameters rather than relying on prebuilt 3D models.

The system should support:

V1 goals (milestones M1–M8, plan §3–10):

* mineral crystallography (all seven crystal systems, validated gradually — see plan §1)
* Miller and Miller-Bravais indices
* symmetry-equivalent faces
* procedural crystal morphology
* adjustable crystal forms
* named crystal habits
* crystallographic axes
* atomic structure visualization
* mineral appearance
* scientific references and data provenance

Later goals (milestones M9–M10, plan §11–12):

* twinning
* pressure and temperature effects where scientifically supported
* phase changes

The initial implementation should **not depend on React, Vue, Svelte, Angular, or another UI framework**.

The viewer is delivered as a framework-agnostic Web Component. Users integrate it into React, Vue, Svelte, Electron, Tauri, or any other browser-based environment by wrapping the component themselves; no framework-specific wrapper packages are provided.

The reference application should use plain HTML, CSS, and TypeScript.

---

# 2. Technology Stack

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

# 3. Architectural Principles

The architecture is layered (see §4 for the concrete package graph): viewer API on top of a Three.js rendering layer, on top of crystal geometry generation, on top of the crystallographic engine, on top of mineral/morphology data.

The system must maintain strict separation between:

1. crystallographic mathematics
2. mineral data
3. geometry generation
4. rendering
5. user interface

The crystallographic engine must be usable without a browser or renderer.

---

# 4. Package Structure

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

# 5. Core Data Model

All interfaces in this document are illustrative pseudocode. They describe what data the system must handle, not final type definitions or package ownership. Interfaces will be designed during implementation.

## 5.1 Mineral

```ts
interface Mineral {
    id: string;
    name: string;
    formula: string;

    crystallography: Crystallography;

    atomicStructure?: AtomicStructure;

    phases?: MineralPhase[];

    habits?: HabitPreset[];

    appearance?: MineralAppearance[];

    twinLaws?: TwinLaw[];

    references?: Reference[];
}
```

`crystallography` is the ambient (default) phase at standard conditions. `phases`, when present, lists alternative structural phases (e.g. high-pressure transformations); it does not duplicate the ambient phase.

---

## 5.2 Crystallography

```ts
interface Crystallography {
    crystalSystem:
        | "triclinic"
        | "monoclinic"
        | "orthorhombic"
        | "tetragonal"
        | "trigonal"
        | "hexagonal"
        | "cubic";

    setting?: string; // Unambiguous registry setting identifier.

    pointGroup?: string;
    spaceGroup?: string;

    unitCell: UnitCell;

    pointOperations?: PointOperation[];
    spaceOperations?: SpaceOperation[];
}
```

### Operation Representation

```ts
interface PointOperation {
    id: string;
    linear: Mat3;
}

interface SpaceOperation {
    id: string;
    linear: Mat3;
    translation: Vec3;
}
```

`Mat3` is a renderer-neutral 3×3 matrix. Operations are active transformations of fractional-coordinate column vectors in the declared lattice basis: point operations use `x' = W x`; space operations use `x' = W x + t`, where `t` is a fractional translation. Rotations, reflections, inversion, and rotoinversions must be representable; an SE(3)-only representation is insufficient. Operation IDs are stable within a resolved operation set.

Face generation uses point operations. Atomic symmetry expansion uses full space operations. Derive the point-operation set from space operations by discarding translations and deduplicating the linear matrices. CIF operation strings are parsed into this representation before use by the engine.

### Symmetry Resolution

Resolve all supplied symmetry descriptions into one validated operation set before geometry generation. The resolved operations are the engine's source of truth.

| Available input | Resolution |
|---|---|
| Explicit space operations | Validate and derive point operations |
| Unambiguous space-group identifier and setting | Resolve operations from a supported registry |
| Explicit point operations only | Allow morphology; insufficient for atomic symmetry expansion |
| Point-group identifier and setting only | Resolve point operations for morphology |
| Crystal system or unit cell only | Report missing symmetry |

When multiple descriptions are supplied, require agreement in the same basis and setting; do not silently prefer one conflicting description. Missing symmetry must not imply identity-only symmetry. Identity-only symmetry must be explicitly requested. Do not infer a mineral's point group from its crystal system or unit-cell dimensions.

All operations, indices, and atomic positions must use the same declared basis. A registry setting identifier must resolve axis and origin choices where applicable, including hexagonal versus rhombohedral settings. Explicit operations refer directly to the supplied unit-cell basis. Ambiguous identifiers and unsupported settings produce input-validation diagnostics rather than guessed operations.

Validate complete operation sets for identity, closure, inverses, and compatibility with the unit-cell metric using documented tolerances. For space operations, compare translations modulo lattice translations. Missing, conflicting, or invalid symmetry is an input-validation error reported before geometry generation, separate from the intersection failures in §9.

These coordinate conventions follow the [IUCr matrix representation of crystallographic symmetry](https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry).

---

## 5.3 Unit Cell

```ts
interface UnitCell {
    a: number;
    b: number;
    c: number;

    alpha: number;
    beta: number;
    gamma: number;
}
```

Angles are expressed in degrees.

Lengths should use a consistent internal unit.

For crystallographic source data, Ångström is recommended.

---

## 5.4 Atomic Structure

```ts
interface AtomicStructure {
    siteRepresentation: "asymmetric-unit" | "complete-cell";

    sites: AtomSite[];

    bonds?: PeriodicBond[];
}
```

```ts
interface AtomSite {
    id: string;

    element: string;

    position: [number, number, number];

    occupancy?: number;

    label?: string;
}
```

`position` uses fractional coordinates relative to the enclosing phase's `Crystallography.unitCell` (the mineral's default crystallography for the ambient phase). This is the single authoritative unit cell; `AtomicStructure` does not carry a separate cell. Atomic structure and morphology share its declared lattice basis.

Import a separate structural definition's cell, symmetry, and sites together, or explicitly transform them into the existing definition's basis. Reject incompatible combinations rather than silently attaching sites to a different cell.

### Site Expansion

`asymmetric-unit` sites require expansion using the resolved space operations (§5.2). `complete-cell` sites are already expanded and must not undergo symmetry expansion again.

For asymmetric-unit input:

1. Apply each resolved space operation to each source site.
2. Wrap generated fractional positions into `[0, 1)`.
3. Merge equivalent periodic images of the same source site using a documented positional tolerance that accounts for the unit-cell metric.
4. Preserve source-site and operation IDs on the generated atoms.

Keep imported sites separate from the expanded reference-cell structure used for rendering. Expanded sites have stable IDs within that structural definition. Complete-cell input follows the same reference-cell wrapping convention; preserve cell offsets when resolving bond endpoints.

Do not automatically merge distinct source records at the same position: they may represent alternative elements or disorder. Omitted occupancy means `1`. Preserve partial occupancy as metadata; do not randomly remove atoms or present partial occupancy as full occupancy without an indication.

### Periodic Bonds

```ts
interface AtomImage {
    siteId: string; // Stable ID in the expanded reference cell.
    cellOffset: [number, number, number]; // Integer lattice offsets.
}

interface PeriodicBond {
    a: AtomImage;
    b: AtomImage;

    order?: number;
}
```

Bond endpoints refer to the expanded reference-cell structure, not indices into the imported `sites` array. For example, a bond can connect site A in `[0, 0, 0]` to site B in `[1, 0, 0]`. Imported bonds referring to symmetry operations must be resolved into these expanded-site endpoints while preserving source information.

Bond generation is optional. If bonds are inferred from distances, document the inference method and label those bonds as derived. Missing bonds must still permit an atoms-only view.

---

# 6. Morphology Data Model

Crystal morphology must be distinct from atomic crystal structure.

A mineral may have many different external habits while retaining essentially the same crystal structure.

## 6.1 Habit Preset

```ts
interface HabitPreset {
    id: string;
    name: string;

    description?: string;

    forms: CrystalFormSetting[];

    orientation?: Vec3;

    asymmetry?: AsymmetryConstraint[];

    references?: Reference[];
}
```

`orientation` specifies a preferred viewing direction. `asymmetry` constrains which forms appear on which sides of the crystal, as described in §12.

> **TODO:** Define `AsymmetryConstraint` using the resolved symmetry operations (§5.2) and face provenance (§9) to identify which equivalent faces it affects.

---

## 6.2 Crystal Form

```ts
interface CrystalFormSetting {
    id: string;

    label?: string;

    indices: MillerIndices;

    development: number;

    enabled: boolean;
}
```

When `enabled` is `false`, the form is omitted from the half-space intersection entirely.

`development` is a viewer-facing control in the range [0, 1]. `0` means the form is absent; `1` places its planes at the closest permitted distance. For an active form, the viewer maps development to a positive support distance using `distance = morphologyScale / development`. The geometry engine operates on these support distances. Development is not a face-area fraction: resulting face areas depend on all active forms. See §10.

---

# 7. Miller Indices

Support ordinary Miller indices:

```text
(h k l)
```

and, where appropriate, Miller-Bravais notation:

```text
(h k i l)
```

particularly for trigonal and hexagonal systems.

In Miller-Bravais notation, `i = -(h + k)`.

Internally, all forms should be convertible into reciprocal-space plane normals.

Normalize Miller-Bravais input into three-index coordinates in the declared lattice basis before applying symmetry. The public `MillerIndices` type may preserve the input notation for display; the geometry calculation uses three-index columns.

For an active point operation `x' = W x`, transform the Miller-index column by `h' = inverse(transpose(W)) h`. Convert the transformed indices through the reciprocal lattice into a Cartesian unit normal. Real-space and reciprocal-space transformations must remain distinct; see the [IUCr symmetry tutorial](https://www.iucr.org/what-we-do/education/pamphlets/rotation-matrices-and-translation-vectors-in-crystallography).

Deduplicate equivalent oriented planes while preserving originating form and operation IDs. Preserve the distinction between `h` and `-h`; do not automatically add opposite faces or inversion symmetry. Multiple operations producing the same oriented plane should retain their provenance without duplicating that plane.

---

# 8. Crystal Geometry Engine

The core procedural generation pipeline should be:

```text
Unit cell and symmetry descriptions
    ↓
input validation and symmetry resolution
    ↓
direct lattice basis
    ↓
reciprocal lattice
    ↓
Miller indices in the declared basis
    ↓
resolved point operations (inverse-transpose action)
    ↓
equivalent indices and Cartesian unit normals
    ↓
symmetry-equivalent planes
    ↓
positive support distances
    ↓
half-space intersection
    ↓
convex crystal polyhedron
```

The resulting geometry must not depend on Three.js.

---

# 9. Geometry Output

The core generator must return an explicit, renderer-neutral result. Geometry is available only for a valid, bounded three-dimensional intersection.

```ts
type GeometryResult =
    | { status: "valid"; geometry: CrystalGeometry }
    | {
          status: "invalid";
          reason:
              | "no-active-forms"
              | "unbounded"
              | "degenerate"
              | "numerical-failure";
          message: string;
          formIds?: string[];
      };
```

Invalid results distinguish these cases:

* `no-active-forms`: all forms are disabled or have zero development.
* `unbounded`: the active planes do not enclose a finite volume, such as a prism without end caps.
* `degenerate`: the computed intersection lacks a usable three-dimensional volume under the validation tolerances (§39).
* `numerical-failure`: a reliable result cannot be computed.

Diagnostics must explain the failure and identify relevant forms where possible. An invalid result must not expose a partial mesh as valid geometry.

Example:

```ts
interface CrystalGeometry {
    vertices: Float32Array;

    faces: CrystalFace[];

    bounds: {
        min: Vec3;
        max: Vec3;
    };
}
```

A face should contain crystallographic metadata:

```ts
interface CrystalFace {
    vertexIndices: number[];

    normal: Vec3;

    formId: string;

    indices: MillerIndices;

    operationIds: string[];

    symmetryGroup?: string;
}
```

This allows the rendering layer to identify every visible face.

> **TODO:** Define `Vec3` — since `crystal-core` must not import Three.js, this must be a plain type (e.g. `[number, number, number]`), not `THREE.Vector3`.

> **TODO:** Specify whether `CrystalFace.vertexIndices` is a polygon loop or triangle indices, and where triangulation happens.

`symmetryGroup` is the point group symbol (e.g. `"3m"`, `"m-3m"`) identifying the symmetry set that generated this face.

---

# 10. Half-Space Intersection

Each generated crystallographic plane defines a half-space.

The final crystal is:

```text
intersection(all crystallographic half-spaces)
```

Each active form has a positive support distance measured from the morphology origin along its unit outward normal. Each generated plane defines the half-space `n · (x - origin) <= distance`, where `n` is that unit normal.

The morphology origin is the geometric center of the unit cell. The viewer maps each form's `development` (§6.2) to a support distance:

```text
enabled = false or development = 0: omit the form's planes
otherwise: distance = morphologyScale / development
```

`morphologyScale` is a finite, strictly positive morphology parameter measured in Ångström and shared by all forms. It controls overall size independently of their relative development. At maximum development (`1`), the distance is `morphologyScale`, not zero. As positive development approaches zero, the distance approaches infinity; zero itself is handled by omission, without division.

Increasing development moves the form's planes toward the origin. The resulting face areas depend on all active forms; this does not guarantee increasing absolute face area. Increasing all active development values by the same factor scales the crystal down without changing its proportions.

Geometry is returned in crystallographic units (Ångström). `crystal-core` does not normalize the output; the renderer uses `bounds` (§9) to frame the camera.

Changing a form's support distance or the shared morphology scale must regenerate the polyhedron.

This is the primary mechanism used to modify habit.

Do not arbitrarily deform mesh vertices after generation.

The engine must detect unbounded and degenerate intersections and return the diagnostic result defined in §9. Do not silently add bounding planes: these would introduce faces without a crystallographic source.

With a common origin and strictly positive support distances, valid input half-spaces contain a neighborhood of that origin. An empty or exactly zero-volume intersection therefore indicates invalid input or a computational problem, rather than an ordinary slider outcome.

---

# 11. Morphology Controls

Morphology controls must operate on crystallographic forms.

Example:

```text
Quartz

Prism m                ───────●──
Rhombohedron r         ─────●────
Rhombohedron z         ───●──────
Steep rhombohedra      ──●───────
```

Changing a slider updates the corresponding development value, which is mapped to a support distance as specified in §10. A value of zero omits the form.

The crystal geometry is then regenerated.

This ensures the resulting crystal remains crystallographically meaningful.

---

# 12. Habit Presets

Named habits should be implemented as parameter presets.

Example for quartz:

```text
Normal / Prismatic
Tessin
Dauphiné habit
Cumberland
Pseudocubic
Muzo
Needle / Acicular
```

Each preset should define:

* active forms
* development values
* optional orientation
* optional asymmetry constraints
* source references

A habit name should not be treated as an independent mesh.

---

# 13. Supported Crystal Systems

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

The implementation sequence is defined in plan §1.

---

# 14. Initial Minerals

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

# 15. Three.js Rendering Layer

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

# 16. Viewer API

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

# 17. Viewer Lifecycle

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

## Invalid Geometry and Recovery

When requested form settings produce an invalid geometry result (§9), the viewer must:

* retain the requested settings so the user can continue editing toward a valid combination;
* retain the last valid mesh, if one exists, and expose that it represents previous valid settings rather than the current request;
* emit `geometry-invalid` with the diagnostic;
* show no crystal mesh if no valid mesh exists yet.

The viewer must expose the current geometry status and distinguish requested settings from the settings associated with the displayed mesh. Serialized form settings represent the requested settings, including when they are currently invalid. The host application is responsible for visibly identifying a retained mesh as stale and displaying the diagnostic; the viewer does not create application UI controls. The reference application must demonstrate this behavior.

On the next valid result, replace the displayed mesh, clear the invalid/stale status, and emit `geometry-changed`. An invalid edit does not emit `geometry-changed` for an unchanged retained mesh.

---

# 18. Events

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

`geometry-invalid` is required for failed geometry generation. Its detail contains the invalid result's `reason`, `message`, and optional `formIds` (§9). Recovery follows §17.

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

# 19. Picking and Face Inspection

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

# 20. Crystallographic Axes

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

# 21. Unit Cell Visualization

Provide an optional unit-cell overlay.

Display:

* unit-cell edges
* lattice vectors
* crystallographic axes
* cell dimensions
* cell angles

The unit cell should remain correctly oriented relative to the external crystal.

---

# 22. CIF Support

Implement a CIF parser or integrate an appropriate lightweight CIF parsing library.

Extract at minimum:

```text
unit-cell lengths
unit-cell angles
space group
symmetry operations
atomic positions
element types
site identifiers and occupancies where available
measurement temperature if available
```

Imported CIF data should be converted into the internal `crystal-data` schema.

The importer must establish whether sites are symmetry-independent or already describe a complete cell according to its supported import convention, and set `siteRepresentation` explicitly (§5.4). If it cannot determine this reliably, report an import diagnostic rather than guessing. Import cell, symmetry, and sites as one structural definition and apply the cell/basis compatibility rules in §5.4 when combining it with existing data.

When importing bonds, resolve symmetry references and cell translations into periodic endpoints in the expanded reference cell. Preserve source information and distinguish imported bonds from inferred bonds.

CIF import does not automatically define external morphology.

---

# 23. Atomic Structure Mode

The viewer should eventually support:

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

# 24. Combined Structure / Morphology View

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

# 25. Mineral Appearance

Appearance must remain separate from crystallographic shape.

Recommended model:

```ts
interface MineralAppearance {
    id: string;
    name: string;

    baseColor?: string;

    roughness?: number;

    metalness?: number;

    transmission?: number;

    opacity?: number;

    ior?: number;

    absorptionColor?: string;

    absorptionDensity?: number;
}
```

Examples for quartz may include:

```text
Rock crystal
Amethyst
Smoky quartz
Citrine
Rose quartz
```

These should not modify crystallographic geometry unless explicitly required.

---

# 26. Initial Rendering Quality

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

# 27. Surface Detail

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

# 28. Twinning

Twinning should be implemented after single-crystal generation is stable.

Architecture:

```text
single crystal generator
       ↓
twin transform
       ↓
second crystal orientation
       ↓
combined geometry
```

Possible initial examples:

```text
Dauphiné quartz twin
Brazil quartz twin
Japan-law quartz twin
Carlsbad feldspar twin
```

Twin operations should use crystallographic transforms rather than handcrafted meshes.

```ts
interface TwinLaw {
    id: string;
    name: string;

    transform: SpaceOperation;
}
```

The `transform` is the crystallographic operation relating the two twin orientations, using the affine representation in §5.2. It need not belong to the single crystal's symmetry group and must not be included in that group's closure validation.

---

# 29. Pressure and Temperature

Pressure and temperature controls may be implemented where sufficient scientific data exists.

They should affect only properties supported by data.

Possible effects:

```text
unit-cell dimensions
cell volume
density
phase stability
phase transitions
```

Temperature and pressure should not automatically control external habit unless a specific supported model exists.

---

# 30. Thermal Expansion

Store appropriate coefficients or models where available.

Possible model:

```ts
interface ThermalExpansionModel {
    referenceTemperature: number;

    evaluate(
        temperature: number
    ): UnitCell;
}
```

Support anisotropic expansion when required.

---

# 31. Pressure / Equation of State

Pressure-dependent unit-cell changes should use an appropriate equation of state.

Example model:

```ts
interface EquationOfState {
    referencePressure: number;

    evaluate(
        pressure: number,
        temperature?: number
    ): UnitCell;
}
```

Do not simulate pressure effects with arbitrary mesh scaling.

---

# 32. Phase Data

A mineral may have multiple structural phases.

Example:

```ts
interface MineralPhase {
    id: string;
    name: string;

    crystallography: Crystallography;

    atomicStructure?: AtomicStructure;

    stability?: StabilityRegion;

    equationOfState?: EquationOfState;

    thermalExpansion?: ThermalExpansionModel;
}
```

Changing temperature or pressure may move the mineral into another phase where documented.

The internal structure may therefore change discontinuously rather than simply deforming.

> **TODO:** Define `StabilityRegion` — referenced in `MineralPhase.stability` but never defined.

---

# 33. Scientific Confidence / Provenance

Every curated parameter should optionally contain source metadata.

Example:

```ts
interface Reference {
    id: string;

    title?: string;
    authors?: string[];

    year?: number;

    doi?: string;
    url?: string;

    notes?: string;
}
```

Data fields may optionally record their source.

Example:

```ts
interface SourcedValue<T> {
    value: T;

    referenceIds: string[];

    status:
        | "reported"
        | "derived"
        | "estimated";
}
```

> **TODO:** `SourcedValue` is defined but not used in the data model. Either wire it into the schema or mark provenance as a future extension.

---

# 34. Data Classification

Where useful, display scientific status:

```text
Measured
Reported
Calculated
Derived
Curated
Estimated
```

Do not present all parameters as having equal scientific authority.

---

# 35. Data Sources

Potential sources include:

```text
Crystallography Open Database
RRUFF
American Mineralogist Crystal Structure Database
IUCr data
mineralogical literature
historical crystallographic literature
museum data
public-domain crystallographic atlases
```

Licensing must be checked individually.

Do not automatically redistribute data or images without verifying applicable rights.

---

# 36. State Serialization

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

---

# 37. Export

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

# 38. Testing

Add automated tests to the code for all packages. Use published crystallographic examples as test fixtures where applicable.

---

# 39. Geometry Validation

Generated crystals should be checked for:

```text
closed geometry
consistent face winding
no duplicate vertices
no duplicate faces
valid normals
finite coordinates
correct symmetry
expected number of equivalent faces
```

Failures must produce the diagnostic result described in §9.

Use scale-relative numerical tolerances for intersection and geometry validation. Within the supported numerical range, changing only `morphologyScale` must not change whether the same shape is classified as valid. Define and document these tolerances during M1.

Distinguish symmetry-equivalent input planes from surviving polygon faces. A redundant plane may produce no face without invalidating the crystal; validation must allow this.

---

# 40. Reference Viewer

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

# 41. Important Scientific Limitation

A CIF or unit-cell definition determines crystallographic data (system, unit cell, symmetry, atomic structure, valid planes, interfacial angles) but does not determine external morphology (which forms are present, relative development, named habit, growth asymmetry, impurity effects, imperfections). This distinction is stated in §6, §22, and §29 and must remain explicit throughout the project.

---

# 42. Non-Goals for Initial Version

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

# 43. Core Design Rule

The central rule of the project is:

> Generate scientifically valid ideal crystal geometry from crystallographic planes and morphology parameters. Keep scientific geometry independent from visualization, UI, and cosmetic appearance.

# Parametric Mineral Crystal Viewer — Scientific Model

Coordinate conventions, symmetry, procedural geometry, physical models, and scientific validation. Persistent mineral records and imports live in the [data model](data-model.md).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Operation Representation

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

## Symmetry Resolution

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

Validate complete operation sets for identity, closure, inverses, and compatibility with the unit-cell metric using documented tolerances. For space operations, compare translations modulo lattice translations. Missing, conflicting, or invalid symmetry is an input-validation error reported before geometry generation, separate from the intersection failures in [Geometry Output](scientific-model.md#geometry-output).

These coordinate conventions follow the [IUCr matrix representation of crystallographic symmetry](https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry).

---

## Miller Indices

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

During symmetry expansion, deduplicate equivalent oriented directions within each form while preserving all originating operation IDs. Preserve the distinction between `h` and `-h`; do not automatically add opposite faces or inversion symmetry. Once support distances are assigned, combine constraints across forms according to [Overlapping Plane Constraints](#overlapping-plane-constraints); matching directions alone do not make planes coincident.

---

## Crystal Geometry Engine

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

## Geometry Output

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
* `degenerate`: the computed intersection lacks a usable three-dimensional volume under the validation tolerances ([Geometry Validation](scientific-model.md#geometry-validation)).
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

    contributors: FaceContributor[];

    symmetryGroup?: string;
}

interface FaceContributor {
    formId: string;

    indices: MillerIndices;

    operationIds: string[];
}
```

Every visible face must expose all contributing forms, with oriented indices and originating operation IDs grouped by form. Contributor attribution follows [Overlapping Plane Constraints](#overlapping-plane-constraints). Exact types remain illustrative; a single primary form must not replace the full provenance.

> **Open decision — deferred to M1:** Define `Vec3` — since `crystal-core` must not import Three.js, this must be a plain type (e.g. `[number, number, number]`), not `THREE.Vector3`.

> **Open decision — deferred to M1:** Specify whether `CrystalFace.vertexIndices` is a polygon loop or triangle indices, and where triangulation happens.

`symmetryGroup` is the point group symbol (e.g. `"3m"`, `"m-3m"`) identifying the symmetry set that generated this face.

---

## Half-Space Intersection

Each generated crystallographic plane defines a half-space.

The final crystal is:

```text
intersection(all crystallographic half-spaces)
```

Each active form has a positive support distance measured from the morphology origin along its unit outward normal. Each generated plane defines the half-space `n · (x - origin) <= distance`, where `n` is that unit normal.

The morphology origin is the geometric center of the unit cell. The viewer maps each form's `development` ([Crystal Form](data-model.md#crystal-form)) to a support distance:

```text
enabled = false or development = 0: omit the form's planes
otherwise: distance = morphologyScale / development
```

`morphologyScale` is a finite, strictly positive morphology parameter measured in Ångström and shared by all forms. It controls overall size independently of their relative development. At maximum development (`1`), the distance is `morphologyScale`, not zero. As positive development approaches zero, the distance approaches infinity; zero itself is handled by omission, without division.

Increasing development moves the form's planes toward the origin. The resulting face areas depend on all active forms; this does not guarantee increasing absolute face area. Increasing all active development values by the same factor scales the crystal down without changing its proportions.

Geometry is returned in crystallographic units (Ångström). `crystal-core` does not normalize the output; the renderer uses `bounds` ([Geometry Output](scientific-model.md#geometry-output)) to frame the camera.

Changing a form's support distance or the shared morphology scale must regenerate the polyhedron.

This is the primary mechanism used to modify habit.

Do not arbitrarily deform mesh vertices after generation.

The engine must detect unbounded and degenerate intersections and return the diagnostic result defined in [Geometry Output](scientific-model.md#geometry-output). Do not silently add bounding planes: these would introduce faces without a crystallographic source.

With a common origin and strictly positive support distances, valid input half-spaces contain a neighborhood of that origin. An empty or exactly zero-volume intersection therefore indicates invalid input or a computational problem, rather than an ordinary slider outcome.

### Overlapping Plane Constraints

After support distances are assigned, compare constraints using their outward unit normals and distances from the common morphology origin:

* For matching oriented normals with different support distances, retain the smallest distance as the effective boundary. Looser constraints are redundant in that direction and are not contributors to its visible face.
* For coincident constraints, generate one polygon if that boundary survives intersection, retaining every contributing form and its own oriented indices and operation IDs.
* Opposite normals remain separate constraints.

For example, parallel constraints at 10 Å and 6 Å retain the 6 Å boundary and its contributor. Two constraints at 6 Å share that boundary and both contribute.

Define normal and distance comparison tolerances during M1, consistent with [Geometry Validation](#geometry-validation). Use the smallest distance for the effective boundary and attribute constraints coincident with it under those tolerances. Geometry and contributor attribution must not depend on input form order.

Constraint reduction must preserve requested form settings. Recompute effective boundaries and contributors after development changes: a redundant form may become controlling, and contributor attribution may change even when vertex positions do not.

---

## Twinning

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

The `transform` is the crystallographic operation relating the two twin orientations, using the affine representation in [Operation Representation](scientific-model.md#operation-representation). It need not belong to the single crystal's symmetry group and must not be included in that group's closure validation.

---

## Pressure and Temperature

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

## Thermal Expansion

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

## Pressure / Equation of State

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

## Geometry Validation

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

Failures must produce the diagnostic result described in [Geometry Output](scientific-model.md#geometry-output).

Use scale-relative numerical tolerances for intersection and geometry validation. Within the supported numerical range, changing only `morphologyScale` must not change whether the same shape is classified as valid. Define and document these tolerances during M1.

Distinguish symmetry-equivalent input planes from surviving polygon faces. A redundant plane may produce no face without invalidating the crystal; validation must allow this.

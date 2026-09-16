# Parametric Mineral Crystal Viewer — Scientific Model

Coordinate conventions, symmetry, procedural geometry, physical models, and scientific validation. Persistent mineral records and imports live in the [data model](data-model.md).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Coordinate and Lattice Conventions

For unit-cell lengths `a`, `b`, and `c`, let `alpha` be the angle between `b` and `c`, `beta` the angle between `a` and `c`, and `gamma` the angle between `a` and `b`. Convert the angles from degrees to radians and construct the direct-lattice vectors in a deterministic right-handed Cartesian frame:

```text
aVector = (a, 0, 0)
bVector = (b cos(gamma), b sin(gamma), 0)

cX = c cos(beta)
cY = c (cos(alpha) - cos(beta) cos(gamma)) / sin(gamma)
cZ = positive sqrt(c² - cX² - cY²)
cVector = (cX, cY, cZ)
```

The direct-lattice matrix `L` stores `aVector`, `bVector`, and `cVector` as columns. Fractional-coordinate columns map to Cartesian coordinates using `xCartesian = L xFractional`. This places `aVector` on positive X, `bVector` in the XY plane with positive Y, and `cVector` on the positive-Z side.

Use the crystallographic reciprocal basis without a `2 pi` factor:

```text
reciprocalLattice = inverse(transpose(L))
```

The direct and reciprocal basis vectors therefore satisfy `direct_i dot reciprocal_j = delta_ij`. An unnormalized Cartesian normal for the Miller-index column `h` is `inverse(transpose(L)) h`.

Unit-cell lengths must be finite and strictly positive. Angles must be finite and strictly between 0 and 180 degrees. Validate that the metric tensor is positive definite and that the cell volume is above a documented scale-relative tolerance:

```text
G = [
    [a²,                 a b cos(gamma),    a c cos(beta)],
    [a b cos(gamma),     b²,                b c cos(alpha)],
    [a c cos(beta),      b c cos(alpha),    c²]
]
```

A tiny negative `cZ²` caused solely by floating-point rounding may be clamped to zero while evaluating the cell, but the resulting zero-volume cell remains invalid. Reject invalid or degenerate cells with an input-validation diagnostic; do not repair their dimensions or angles.

### Numeric Policy

All numeric scientific inputs must be finite. Reject `NaN`, infinities, and values outside their declared domains before geometry generation; do not silently clamp them except for explicitly documented roundoff handling such as the cell calculation above. Symmetry matrices and translations must contain finite values, and generated vertices, normals, bounds, and support distances must remain finite.

Use JavaScript `number` or `Float64Array` throughout `crystal-core`. Convert geometry to `Float32Array` only in `crystal-three` when producing GPU buffers. Scientific validation, topology, and contributor attribution must not depend on renderer-level precision.

Perform half-space intersection in normalized morphology units, using `1 / development` as each active form's normalized support distance. After valid geometry is obtained, multiply positions and bounds by `morphologyScale` so the public geometry remains in Ångström. Reject an input if deriving its normalized support distance produces a non-finite value. A finite, valid input that still cannot be computed reliably returns `core.geometry.numerical-failure` rather than being reclassified as invalid input.

Use named tolerances for distinct operations, including matrix validation, plane comparison, vertex merging, and volume or degeneracy checks. Base them primarily on the magnitude of normalized geometry, with a documented absolute floor for values near zero. Do not use one global epsilon. Define the constants and supported numerical range during M1 and validate them with scale and near-degeneracy tests.

---

## Operation Representation

```ts
type Vec3 = readonly [number, number, number];
```

`Vec3` is a renderer-neutral, immutable Cartesian or fractional triple as identified by its surrounding contract. It must not expose Three.js or browser types.

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

Validate complete operation sets for identity, closure, inverses, and compatibility with the unit-cell metric using documented tolerances. For space operations, compare translations modulo lattice translations. Missing, conflicting, or invalid symmetry is an input-validation error reported before geometry generation, separate from the intersection failures in [Geometry Output](#geometry-output).

These coordinate conventions follow the [IUCr matrix representation of crystallographic symmetry](https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry).

### Operation Registry

Registry entries are setting-specific, versioned scientific data owned by `crystal-core`. Each entry must contain:

* a stable internal identifier;
* the point-group or space-group identity used for lookup;
* an unambiguous basis, axis, origin, and setting identifier;
* the normalized operations in the conventions above;
* source identity, source version or access date, and applicable license or terms; and
* the normalization or generation method and an integrity hash for generated artifacts.

Prefer a machine-readable, permissively redistributable source with pinned versioning. Do not scrape an interactive service or copy a full proprietary table into the repository. Commit the normalized registry subset needed by the shipped implementation together with a reproducible generation or normalization tool when licensing permits redistribution.

M1 needs only the validated subset required by its cubic prototype. Expand registry coverage with later crystal-system and CIF milestones. Every entry must pass identity, closure, inverse, metric-compatibility, and explicit-operation equivalence tests before acceptance. Unsupported identifiers or settings produce diagnostics rather than guessed mappings.

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

`MillerIndices` is a tagged value that preserves whether the input uses three-index Miller notation or four-index Miller-Bravais notation. The exact TypeScript representation is deferred to M1; an illustrative shape is:

```ts
type MillerIndices =
    | { notation: "miller"; h: number; k: number; l: number }
    | {
          notation: "miller-bravais";
          h: number;
          k: number;
          i: number;
          l: number;
      };
```

Every component must be an integer, and the components must not all be zero. Reduce a common non-zero integer factor to obtain the canonical indices used for calculation and comparison, without reversing their collective sign. Thus an index set and its negation remain opposite oriented planes rather than one canonical value.

In Miller-Bravais notation, `i = -(h + k)`.

Miller-Bravais input is valid only for a compatible trigonal or hexagonal setting. Preserve the notation kind for display and serialization. Any convenience display in another notation must be identified as converted.

Internally, all forms should be convertible into reciprocal-space plane normals.

Normalize Miller-Bravais input into three-index coordinates in the declared lattice basis before applying symmetry. Define the exact setting-aware conversion during M3 and validate it against published hexagonal and trigonal reference cases. The geometry calculation uses three-index columns.

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
          diagnostic: Diagnostic & {
              code:
                  | "core.geometry.no-active-forms"
                  | "core.geometry.unbounded"
                  | "core.geometry.degenerate"
                  | "core.geometry.numerical-failure";
              severity: "error";
          };
      };
```

The shared diagnostic envelope and handling rules are defined in [Diagnostics](architecture.md#diagnostics).

Invalid results distinguish these cases:

* `core.geometry.no-active-forms`: all forms are disabled or have zero development.
* `core.geometry.unbounded`: the active planes do not enclose a finite volume, such as a prism without end caps.
* `core.geometry.degenerate`: the computed intersection lacks a usable three-dimensional volume under the validation tolerances ([Geometry Validation](#geometry-validation)).
* `core.geometry.numerical-failure`: a reliable result cannot be computed.

Diagnostics must explain the failure and identify relevant forms where possible. An invalid result must not expose a partial mesh as valid geometry.

Example:

```ts
interface CrystalGeometry {
    vertices: Float64Array;

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

`CrystalFace.vertexIndices` is an ordered polygon boundary with at least three vertex indices; it does not repeat the first index at the end. Winding is counterclockwise when viewed from outside the crystal and agrees with the unit outward `normal`. Core geometry preserves these crystallographic polygons. `crystal-three` triangulates each convex polygon deterministically and retains the originating core face index on every rendered triangle for picking and inspection.

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

`development` must be finite and within `[0, 1]`. Values outside that range are input-validation errors rather than values to clamp. `morphologyScale` is a finite, strictly positive morphology parameter measured in Ångström and shared by all forms. It controls overall size independently of their relative development. At maximum development (`1`), the distance is `morphologyScale`, not zero. As positive development approaches zero, the distance approaches infinity; zero itself is handled by omission, without division. The [numeric policy](#numeric-policy) defines the normalized internal calculation.

Increasing development moves the form's planes toward the origin. The resulting face areas depend on all active forms; this does not guarantee increasing absolute face area. Increasing all active development values by the same factor scales the crystal down without changing its proportions.

Geometry and morphology support distances follow the [internal unit convention](data-model.md#unit-cell): returned lengths are in Ångström. Internal scale normalization does not change the output contract; the renderer uses `bounds` ([Geometry Output](#geometry-output)) to frame the camera.

Changing a form's support distance or the shared morphology scale must regenerate the polyhedron.

This is the primary mechanism used to modify habit.

Do not arbitrarily deform mesh vertices after generation.

The engine must detect unbounded and degenerate intersections and return the diagnostic result defined in [Geometry Output](#geometry-output). Do not silently add bounding planes: these would introduce faces without a crystallographic source.

With a common origin and strictly positive support distances, valid input half-spaces contain a neighborhood of that origin. An empty or exactly zero-volume intersection therefore indicates invalid input or a computational problem, rather than an ordinary slider outcome.

### Overlapping Plane Constraints

After support distances are assigned, compare constraints using their outward unit normals and distances from the common morphology origin:

* For matching oriented normals with different support distances, retain the smallest distance as the effective boundary. Looser constraints are redundant in that direction and are not contributors to its visible face.
* For coincident constraints, generate one polygon if that boundary survives intersection, retaining every contributing form and its own oriented indices and operation IDs.
* Opposite normals remain separate constraints.

For example, parallel constraints at 10 Å and 6 Å retain the 6 Å boundary and its contributor. Two constraints at 6 Å share that boundary and both contribute.

Define normal and distance comparison tolerances during M1, consistent with [Geometry Validation](#geometry-validation). Use the smallest distance for the effective boundary and attribute constraints coincident with it under those tolerances. Geometry and contributor attribution must not depend on input form order.

Constraint reduction must preserve requested form settings. Recompute effective boundaries and contributors after development changes: a redundant form may become controlling, and contributor attribution may change even when vertex positions do not.

### Intersection Algorithm

V1 uses direct triple-plane enumeration after symmetry-equivalent directions and overlapping constraints have been reduced:

1. Check whether the active outward normals positively span three-dimensional space. Equivalently, the origin must lie strictly inside their convex hull. If not, return `core.geometry.unbounded` without introducing artificial bounding planes.
2. Enumerate each combination of three effective planes and solve their equations in double precision.
3. Skip linearly dependent triples under the matrix tolerance.
4. Retain a solution only when it satisfies every half-space under the plane tolerance.
5. Merge coincident solutions under the vertex tolerance.
6. For each effective plane, collect coincident vertices, project them into a local two-dimensional basis, order them around their centroid, remove redundant collinear vertices, and orient the polygon consistently with its outward normal.
7. Validate closure, winding, volume, finite coordinates, topology, and contributor attribution before returning valid geometry.

A bounded result with fewer than four non-coplanar vertices or without usable volume returns `core.geometry.degenerate`. The implementation must produce deterministic geometry and contributor attribution when input forms or constraints are reordered.

Benchmark representative and deliberately large V1 plane sets during M1. Replace the algorithm only behind the same geometry contract and with a superseding decision record if measured interaction performance or robustness is insufficient. The accepted rationale and alternatives are recorded in [Direct Half-Space Intersection and Polygon Output](decisions/0002-direct-half-space-intersection.md).

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

The `transform` is the crystallographic operation relating the two twin orientations, using the affine representation in [Operation Representation](#operation-representation). It need not belong to the single crystal's symmetry group and must not be included in that group's closure validation.

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

Failures must produce the diagnostic result described in [Geometry Output](#geometry-output).

Follow the [numeric policy](#numeric-policy) for intersection and geometry-validation tolerances. Within the supported numerical range, changing only `morphologyScale` must not change whether the same shape is classified as valid.

Distinguish symmetry-equivalent input planes from surviving polygon faces. A redundant plane may produce no face without invalidating the crystal; validation must allow this.

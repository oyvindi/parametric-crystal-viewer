# Parametric Mineral Crystal Viewer — Data Model

Mineral and morphology records, atomic structure, imports, phases, and provenance. Mathematical conventions live in the [scientific model](scientific-model.md).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Core Data Model

Interfaces in this document are illustrative pseudocode describing required behavior. The implemented M4 mineral, morphology, reference, and provenance types live in [crystal-data](../packages/crystal-data/src/types.ts); its [package documentation](../packages/crystal-data/README.md) describes validation and loading. Structural and later-scope examples remain illustrative until their implementation milestones.

### Mineral

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

`TwinLaw` and its crystallographic transform are defined in [Twinning](scientific-model.md#twinning).

---

### Crystallography

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

Operation types, coordinate conventions, and resolution rules are defined in the [scientific model](scientific-model.md#operation-representation).

### Quartz Handedness

Supported left- and right-handed quartz variants must be defined using sourced crystallographic data, including their symmetry and form assignments in the declared basis. Exact record representation remains an implementation decision. Validate the variants against reference fixtures; not every habit is required to have a visibly different morphology for the two variants.

### Unit Cell

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

Unit-cell lengths use Ångström (Å), and unit-cell angles use degrees. Imported lengths expressed in other units must be converted to Ångström before entering the normalized data model. Preserve the original units in source metadata when provided. Inputs with unknown or ambiguous units must produce a validation diagnostic rather than assuming a unit. Cartesian construction and cell-validity rules are defined in [Coordinate and Lattice Conventions](scientific-model.md#coordinate-and-lattice-conventions).

---

### Atomic Structure

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

#### Site Expansion

`asymmetric-unit` sites require expansion using the resolved space operations ([Symmetry Resolution](scientific-model.md#symmetry-resolution)). `complete-cell` sites are already expanded and must not undergo symmetry expansion again.

For asymmetric-unit input:

1. Apply each resolved space operation to each source site.
2. Wrap generated fractional positions into `[0, 1)`.
3. Merge equivalent periodic images of the same source site using a documented positional tolerance that accounts for the unit-cell metric.
4. Preserve source-site and operation IDs on the generated atoms.

Keep imported sites separate from the expanded reference-cell structure used for rendering. Expanded sites have stable IDs within that structural definition. Complete-cell input follows the same reference-cell wrapping convention; preserve cell offsets when resolving bond endpoints.

Do not automatically merge distinct source records at the same position: they may represent alternative elements or disorder. Omitted occupancy means `1`. Preserve partial occupancy as metadata; do not randomly remove atoms or present partial occupancy as full occupancy without an indication.

Every fractional-position component must be finite. Occupancy, when supplied, must be finite and within `[0, 1]`; reject out-of-range values rather than clamping them.

#### Periodic Bonds

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

## Morphology Data Model

Crystal morphology must be distinct from atomic crystal structure.

A mineral may have many different external habits while retaining essentially the same crystal structure.

### Habit Preset

```ts
interface HabitPreset {
    id: string;
    name: string;

    description?: string;

    forms: CrystalFormSetting[];

    preferredView?: PreferredView;

    asymmetry?: AsymmetryConstraint[];

    references?: Reference[];
}
```

```ts
interface PreferredView {
    cameraDirection: Vec3;
    upDirection?: Vec3;
}
```

`preferredView` is presentation metadata and never modifies scientific geometry. Both vectors use the deterministic crystal-local Cartesian frame from [Coordinate and Lattice Conventions](scientific-model.md#coordinate-and-lattice-conventions). `cameraDirection` points from the morphology origin toward the camera. Components must be finite and the vector must be non-zero. When supplied, `upDirection` must also be finite and non-zero and must not be parallel to `cameraDirection`; the viewer projects and normalizes it in the view plane.

When `upDirection` is absent, derive a deterministic up direction from the Cartesian `c` lattice vector, falling back to `b` and then `a` if projection is too close to zero. Viewer application and state precedence are defined in [Camera and Preferred Views](viewer-api.md#camera-and-preferred-views).

`asymmetry` is an illustrative extension for unequal development of symmetry-equivalent faces within a form; its behavior is unresolved. Different development values for separate forms are already supported and do not require this extension.

> **Open decision — deferred to M3 habit selection:** Determine whether the selected V1 habits require asymmetry within a form. If they do, define and implement the behavior before accepting any dependent preset. Otherwise, record the supporting habit selection and explicitly defer the capability; the illustrative field does not make asymmetry a V1 requirement. Revisit the decision if later habit selection introduces a dependency.

If asymmetry is needed, the decision must specify:

* how affected oriented planes are identified using resolved symmetry and face provenance, including deduplicated planes;
* which overrides are allowed and when they apply in the geometry pipeline;
* how geometry validation distinguishes valid crystallographic face directions from intentionally unequal face development;
* how overrides interact with form sliders, disabled forms, and zero development.

Record the mathematical behavior in the [scientific model](scientific-model.md#half-space-intersection), preset representation here, and control behavior in the [viewer API](viewer-api.md#morphology-controls). Per-face distance multipliers and selective face omission remain undecided until that design is accepted.

---

### Crystal Form

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

`development` is the viewer-facing form control. It must be finite and within `[0, 1]`; its absence behavior and mapping to positive support distance are defined in [Half-Space Intersection](scientific-model.md#half-space-intersection).

---

## Habit Presets

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
* optional preferred view
* optional asymmetry constraints
* source references

A habit name should not be treated as an independent mesh.

### Completed Habit Presets

A shipped habit preset counts toward the [V1 checklist](spec.md#v1-checklist) when it:

* has a stable ID, name, and description;
* identifies its crystallographic forms and development settings;
* generates valid geometry under the [geometry validation contract](scientific-model.md#geometry-validation);
* includes source references supporting the habit identification and forms;
* distinguishes sourced information from curated visualization parameters, including development values.

A source need not supply numerical development values. Curated values must be identified as such rather than presented as measurements.

---

## CIF Support

Implement a CIF parser or integrate an appropriate lightweight CIF parsing library.

### V1 Import Boundary

V1 supports a documented subset of CIF 1.1 structural data. CIF 2.0 is deferred; unsupported formats and constructs must produce import diagnostics. Parser selection remains an implementation decision.

Import errors and warnings use the shared [diagnostic envelope](architecture.md#diagnostics). Import diagnostics use stable `data.cif.*` codes and include source block, line, and column information when available. Warnings may accompany a successfully normalized definition; errors prevent it from being committed.

* **Data blocks:** When a file contains multiple structural blocks, require explicit block selection rather than silently choosing one.
* **Values:** Handle numerical uncertainty notation and missing-value markers explicitly. Missing information required to construct the structural definition produces a diagnostic rather than a fabricated default. Define the supported handling of uncertainty metadata before M6 implementation.
* **Symmetry:** Accept validated explicit operations or identifiers and settings supported by the registry, following [Symmetry Resolution](scientific-model.md#symmetry-resolution). Publish supported registry settings; reject unsupported or ambiguous identifiers. When multiple descriptions are supplied, their agreement remains required.
* **Sites:** Document the supported site-representation convention before M6 implementation and diagnose ambiguous representations, as specified below.
* **Bonds:** CIF bond import is optional for V1. Report when supplied bond data is omitted. Periodic bond resolution and rendering for internal structural data remain required under [Periodic Bonds](#periodic-bonds) and [Atomic Structure Mode](viewer-api.md#atomic-structure-mode). When CIF bonds are imported, the endpoint-resolution requirements below apply.

Before M6 implementation, document the supported tags, constructs, site convention, and registry settings. Validate the boundary using representative successful imports and fixtures for each rejection case. Delivery checks belong to [M6](plan.md#m6--cif--structural-data).

#### Supported CIF 1.1 tags

V1 imports the following CIF 1.1 tags from a single selected data block. Tags are matched case-insensitively by CIF convention; synonyms are accepted where listed.

```text
# unit cell
_cell_length_a, _cell_length_b, _cell_length_c
_cell_angle_alpha, _cell_angle_beta, _cell_angle_gamma
_cell_length_units (angstrom only; nm is normalized, unknown units are rejected)

# symmetry
_space_group_name_H-M_alt, _symmetry_space_group_name_H-M
_space_group_name_Hall, _symmetry_space_group_name_Hall
_space_group.IT_number, _space_group_IT_number
_space_group_symop_operation_xyz, _symmetry_equiv_pos_as_xyz

# atomic sites
_atom_site_type_symbol
_atom_site_label
_atom_site_fract_x, _atom_site_fract_y, _atom_site_fract_z
_atom_site_occupancy
```

The unit-cell lengths and angles are required. Symmetry is required: either an
explicit operation loop (`_space_group_symop_operation_xyz` /
`_symmetry_equiv_pos_as_xyz`) or a registry-supported identifier with setting, never
both silently; multiple descriptions require agreement. Atomic sites require an
element symbol, a label, and fractional coordinates. Occupancy is optional and
defaults to `1`. Cartesian (`_atom_site_Cartn_*`) coordinates are not supported in
V1; supply fractional coordinates or transform first. Measurement temperature
(`_cell_measurement_temperature`) and publication metadata are preserved in source
metadata when present but are not required.

Unsupported constructs produce a diagnostic and do not commit:

* CIF 2.0 syntax (the `version` block or CIF 2.0 delimiters);
* save frames, global blocks, or non-structural loop categories;
* `_atom_site_Cartn_*` Cartesian sites without fractional equivalents;
* partial-occupancy disorder expressed through assemblies/groups rather than
  distinct occupied sites;
* incommensurate/modulated structures; and
* units other than Ångström or nanometre.

#### Site representation convention

The importer infers `siteRepresentation` from the supplied data:

* **`asymmetric-unit`:** the default when explicit space operations or a
  registry identifier are supplied. The listed sites are symmetry-independent and
  are expanded by the resolved space operations ([Site Expansion](#site-expansion)).
  A `_atom_site_symmetry_multiplicity` column present alongside symmetry
  operations is treated as Wyckoff metadata and does not change this inference.
* **`complete-cell`:** declared only when an explicit, unambiguous marker is
  present. V1 recognizes `_atom_site_symmetry_multiplicity` as a complete-cell
  marker only when no symmetry operation loop or identifier is supplied; in that
  case the sites are treated as already expanded and are not expanded a second
  time.

If the representation cannot be determined reliably — for example, neither a
symmetry description nor a complete-cell marker — the importer emits a
`data.cif.ambiguous-site-representation`
diagnostic and does not commit. Distinct source sites at the same fractional
position are never merged: they may represent alternative elements or disorder and
are preserved as separate atoms, including coincident partially occupied
alternatives.

#### Supported registry settings

Symmetry identifiers resolve through the [operation registry](scientific-model.md#operation-registry)
by point-group, crystal system, and setting. V1 supports these settings:

```text
point-group:m-3m:cubic-standard
point-group:m-3:cubic-standard
point-group:-3m:hexagonal-standard
point-group:32:hexagonal-standard
point-group:4/mmm:tetragonal-standard
point-group:6/mmm:hexagonal-standard
point-group:mmm:orthorhombic-standard
point-group:2/m:monoclinic-b
point-group:-1:triclinic-standard
```

A Hermann–Mauguin or Hall symbol that does not map to one of these settings, or
that is ambiguous without a setting, produces a `data.cif.unsupported-symmetry`
diagnostic. Explicit operation loops are always accepted when they validate; they
need not match a registry entry. Space-group numbers alone are not sufficient
without a setting because several space groups share a number across settings or
origins; supply an explicit operation loop for unsupported space groups.

#### Uncertainty and missing-value handling

CIF numerical values may carry parenthesized standard uncertainty (for example
`5.463(2)`) which is parsed and discarded — V1 stores the central value only.
Trailing-`e.s.d.` notation is not supported. The CIF missing-value markers `?`
(unknown) and `.` (inapplicable) are recognized: an optional field marked missing
is omitted from the normalized definition, while a required field marked missing
produces a `data.cif.missing-required` diagnostic rather than a fabricated default.
Uncertainty metadata is not preserved beyond the central value in V1.

### Extraction and Normalization

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

The importer must establish whether sites are symmetry-independent or already describe a complete cell according to its supported import convention, and set `siteRepresentation` explicitly ([Atomic Structure](#atomic-structure)). If it cannot determine this reliably, report an import diagnostic rather than guessing. Import cell, symmetry, and sites as one structural definition and apply those cell/basis compatibility rules when combining it with existing data.

When importing bonds, resolve symmetry references and cell translations into periodic endpoints in the expanded reference cell. Preserve source information and distinguish imported bonds from inferred bonds.

CIF import does not automatically define external morphology.

---

## Mineral Appearance

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

    opacity?: number; // Deferred beyond V1.

    ior?: number;

    absorptionColor?: string;

    absorptionDensity?: number;
}
```

In V1, `transmission` is the mineral-transparency control and uses a normalized range from `0` (no transmission) to `1` (full transmission). It models light passing through a solid material.

`roughness` and `metalness` also use normalized ranges from `0` to `1`. `ior` must be finite and strictly positive. `absorptionDensity` must be finite and non-negative. Exact defaults are selected during M8 and documented with the implemented material mapping.

`opacity` is deferred beyond V1. Renderer-level fading for interaction or illustrative overlays is not part of the mineral appearance record. Before `opacity` can be used in mineral presets or serialized appearance overrides, define its alpha-compositing behavior and interaction with transmission. The two properties must not be treated as complements.

The implemented V1 material mapping lives in [`crystal-three`](../packages/crystal-three/src/appearance.ts). Appearance fields map to a Three.js `MeshPhysicalMaterial`: `baseColor → color`, `roughness → roughness`, `metalness → metalness`, `transmission → transmission`, `ior → ior`, `absorptionColor → attenuationColor`, and `absorptionDensity → attenuationDistance` as `1 / density` (a density of `0` disables absorption, mapped to `Infinity`). Omitted fields resolve to the V1 defaults: base color `#6fb7d4`, roughness `0.3`, metalness `0.1`, transmission `0`, IOR `1.5`, absorption color `#ffffff`, absorption density `0`. A transmissive material (`transmission > 0`) is marked transparent so the renderer sorts it correctly; the volumetric `thickness` is set from the displayed crystal's bounds so absorption scales with the model.

Examples for quartz may include:

```text
Rock crystal
Amethyst
Smoky quartz
Citrine
Rose quartz
```

Appearance settings must not modify scientific geometry. Rendering behavior and visual validation are defined in [Appearance Validation](architecture.md#appearance-validation).

---

## Phase Data

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

> **Open decision — deferred to M10:** Define `StabilityRegion` — referenced in `MineralPhase.stability` but never defined.

---

## Scientific Confidence / Provenance

Provenance is required for shipped scientific data in V1. One provenance entry may cover related fields from the same source; a wrapper around every individual value is not required.

Each entry must identify:

* **Coverage:** the fields or parameter group it describes.
* **Origin:** a source reference, or an explicit statement that the values were curated.
* **Status:** `reported`, `derived`, `curated`, or `estimated`.
* **Derivation:** for derived values, the method and references to the inputs used.

For example, unit-cell parameters may share one literature reference, while habit development values are identified as curated visualization settings. References must identify the source sufficiently to trace the covered information; an otherwise empty reference ID is insufficient.

Imports must preserve available source metadata and distinguish imported values from inferred values. Inferred values are derived and must identify their method and inputs. Missing source information must remain explicit rather than being invented. Imported definitions included in viewer state must retain their provenance through restoration, following [Data Portability and Versions](viewer-api.md#data-portability-and-versions).

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

An individual value may carry provenance directly; grouped entries are also permitted. The following example is illustrative and does not define the complete provenance representation.

Example:

```ts
interface SourcedValue<T> {
    value: T;

    referenceIds: string[];

    status:
        | "reported"
        | "derived"
        | "curated"
        | "estimated";
}
```

Define the minimum provenance representation during M2 with fluorite. Exact schema syntax remains an implementation decision, subject to the coverage, origin, status, and derivation requirements above. The M2 fluorite record establishes this representation with reported crystallography and curated habit development values; see the [M2 acquisition record](sources/m2-acquisition.md) and [acceptance audit](m2-acceptance.md). Apply the same contract to subsequent shipped records and habits; delivery checks are assigned in the [implementation plan](plan.md#mineral-and-crystal-system-coverage).

---

## Data Classification

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

## Data Sources

### Catalog Storage Strategy

V1 stores its small curated mineral catalog as version-controlled normalized records in `crystal-data`; it does not require a server or runtime database. Give records stable identities and data revisions so storage can later move behind a generated index, embedded database, or service without changing the scientific contracts.

When catalog size, search requirements, update frequency, or collaborative editing justify a database, record a separate architectural decision covering storage, ingestion, indexing, distribution, and offline behavior. Do not choose database technology solely to store the initial five minerals.

### Acquisition and Licensing

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

Before a milestone depends on external mineral, structural, symmetry-registry, or scientific fixture data, record the exact source and record identifiers, version or access date, applicable license or terms, intended redistribution, and expected local artifact. Public data with clear compatible terms may be acquired as part of implementation.

Escalate a concrete user-action request when acquisition requires an account, click-through acceptance, paid access, manual download, redistribution judgment, or another action that should be performed by the project owner. State exactly what is needed, why automated acquisition is unsuitable, where the resulting file should be placed, and an expected checksum or other identity check when available. Continue independent work that does not depend on that artifact.

# Parametric Mineral Crystal Viewer — Data Model

Mineral and morphology records, atomic structure, imports, phases, and provenance. Mathematical conventions live in the [scientific model](scientific-model.md).

[Documentation map](spec.md#document-map). Examples are illustrative; see [document status](spec.md#reading-and-status).

## Core Data Model

All interfaces in this document are illustrative pseudocode. They describe what data the system must handle, not final type definitions or package ownership. Interfaces will be designed during implementation.

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

Unit-cell lengths use Ångström (Å), and unit-cell angles use degrees. Imported lengths expressed in other units must be converted to Ångström before entering the normalized data model. Preserve the original units in source metadata when provided. Inputs with unknown or ambiguous units must produce a validation diagnostic rather than assuming a unit.

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

    orientation?: Vec3;

    asymmetry?: AsymmetryConstraint[];

    references?: Reference[];
}
```

`orientation` specifies a preferred viewing direction. `asymmetry` is an illustrative extension for unequal development of symmetry-equivalent faces within a form; its behavior is unresolved. Different development values for separate forms are already supported and do not require this extension.

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

`development` is the viewer-facing form control. Its range, absence behavior, and mapping to positive support distance are defined in [Half-Space Intersection](scientific-model.md#half-space-intersection).

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
* optional orientation
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

* **Data blocks:** When a file contains multiple structural blocks, require explicit block selection rather than silently choosing one.
* **Values:** Handle numerical uncertainty notation and missing-value markers explicitly. Missing information required to construct the structural definition produces a diagnostic rather than a fabricated default. Define the supported handling of uncertainty metadata before M6 implementation.
* **Symmetry:** Accept validated explicit operations or identifiers and settings supported by the registry, following [Symmetry Resolution](scientific-model.md#symmetry-resolution). Publish supported registry settings; reject unsupported or ambiguous identifiers. When multiple descriptions are supplied, their agreement remains required.
* **Sites:** Document the supported site-representation convention before M6 implementation and diagnose ambiguous representations, as specified below.
* **Bonds:** CIF bond import is optional for V1. Report when supplied bond data is omitted. Periodic bond resolution and rendering for internal structural data remain required under [Periodic Bonds](#periodic-bonds) and [Atomic Structure Mode](viewer-api.md#atomic-structure-mode). When CIF bonds are imported, the endpoint-resolution requirements below apply.

Before M6 implementation, document the supported tags, constructs, site convention, and registry settings. Validate the boundary using representative successful imports and fixtures for each rejection case. Delivery checks belong to [M6](plan.md#m6--cif--structural-data).

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

The importer must establish whether sites are symmetry-independent or already describe a complete cell according to its supported import convention, and set `siteRepresentation` explicitly ([Atomic Structure](data-model.md#atomic-structure)). If it cannot determine this reliably, report an import diagnostic rather than guessing. Import cell, symmetry, and sites as one structural definition and apply the cell/basis compatibility rules in [Atomic Structure](data-model.md#atomic-structure) when combining it with existing data.

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

Define the minimum provenance representation during M2 with fluorite. Exact schema syntax remains an implementation decision, subject to the coverage, origin, status, and derivation requirements above. Apply the same contract to subsequent shipped records and habits; delivery checks are assigned in the [implementation plan](plan.md#mineral-and-crystal-system-coverage).

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

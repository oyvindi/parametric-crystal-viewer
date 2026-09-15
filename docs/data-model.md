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

Angles are expressed in degrees.

Lengths should use a consistent internal unit.

For crystallographic source data, Ångström is recommended.

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

`orientation` specifies a preferred viewing direction. `asymmetry` constrains which forms appear on which sides of the crystal, as described in [Habit Presets](data-model.md#habit-presets).

> **Open decision — deferred:** Define `AsymmetryConstraint` using the resolved symmetry operations ([Symmetry Resolution](scientific-model.md#symmetry-resolution)) and face provenance ([Geometry Output](scientific-model.md#geometry-output)) to identify which equivalent faces it affects.

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

---

## CIF Support

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

These should not modify crystallographic geometry unless explicitly required.

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

> **Open decision — deferred:** `SourcedValue` is defined but not used in the data model. Either wire it into the schema or mark provenance as a future extension.

Deferring provenance beyond V1 would require an explicit change to the [V1 checklist](spec.md#v1-checklist); this open question does not itself change release scope.

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

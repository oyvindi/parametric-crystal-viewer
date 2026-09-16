# M5 Acquisition Checkpoint

Status: **in progress; not cleared for mineral/fixture implementation**.
Reviewed on 2026-09-16 after the [M4 acceptance audit](../m4-acceptance.md).
This record tracks the [acquisition checkpoint](../plan.md#data-acquisition-checkpoint)
for M5. Existing M3/M4 work remains intact.

## Selection decision

The following selection is proposed to the project owner, not yet approved.
It resolves the selections left open in the
[coverage matrix](../plan.md#mineral-and-crystal-system-coverage), subject to
source verification and representability checks.

| Role | Proposed selection | Required evidence |
|---|---|---|
| Shipped calcite | Rhombohedral and scalenohedral habits | Source-supported forms in the declared structural-cell basis; curated development values |
| Shipped pyrite | Cubic and pyritohedral habits | Source-supported form indices; correct `m-3` operations rather than fluorite's `m-3m` |
| Shipped anatase; tetragonal fixture | Dipyramidal and tabular habits | Source-supported dipyramid and basal forms; `4/mmm` operations |
| Paired trigonal fixture | Calcite | One sourced definition, explicit hexagonal/rhombohedral basis conversion, matched plane directions and geometry, cell-volume relationship |
| Hexagonal fixture only | Beryl | Identified source record, cell, setting, symmetry and reference plane relationships |
| Orthorhombic fixture only | Forsterite | Identified source record, cell, setting, symmetry and reference plane relationships |
| Monoclinic fixture only | Gypsum | Identified source record, cell, unique-axis convention, symmetry and reference plane relationships |
| Triclinic fixture only | Albite | Identified source record, cell, setting, symmetry and reference plane relationships |

The four test-only minerals do not expand the shipped catalog. The proposed
habits are intended to use full symmetry-equivalent forms. Confirm this during
selection; do not resolve within-form asymmetry or introduce twinning implicitly.

## Symmetry source ready

Reuse [spglib v2.7.0](https://github.com/spglib/spglib/tree/v2.7.0), pinned to
commit `12355c77fb7c505a55f52cae36341d73b781a065`, under BSD-3-Clause.
The locally retained `src/spg_database.c` was rehashed on 2026-09-16 and matches
the [M1 acquisition record](m1-acquisition.md):

```text
bf1ab8a74e1d275e20ee4145bd409b62b5295e680599d3a112a41d396bde56bd
```

Expected artifacts: normalized point-operation subsets and integrity metadata in
`packages/crystal-core/src/registry/`, with an offline generator in `scripts/`.
Retain the existing [license notice](../../packages/crystal-core/src/registry/LICENSE.spglib).
Decode rotations, discard translations for morphology, and deduplicate matrices.
Record exact Hall entries and settings before generation; validate identity,
closure, inverses, metric compatibility and explicit-operation equivalence.
M5 does not claim a full space-group registry or atomic expansion.

## Structural source candidate

The [Crystallography Open Database](https://www.crystallography.net/cod/)
states that contributors placed its data in the public domain and links CC0.
Four individual CIFs have now been downloaded and inspected, as recorded below.
Some browser requests failed, but direct public CIF downloads succeeded without
an account. The files are retained as acquisition inputs outside the repository
at `/tmp/crystal-m5-sources/`.

Before using each record, record its COD identifier, original publication,
revision or access date, cell and setting, experimental conditions where supplied,
exact download URL and file SHA-256. Inspect the artifact itself. Keep structural
values separate from morphology evidence. Expected committed artifacts are
normalized mineral records under `packages/crystal-data/src/minerals/` and sourced
scientific fixtures under `packages/crystal-core/`; choose exact fixture paths
during implementation. Document any committed source extracts and their terms.

## Morphology sources inspected

The following Handbook of Mineralogy pages were read on 2026-09-16:

* [Calcite, version 1](https://www.handbookofmineralogy.org/pdfs/calcite.pdf):
  candidate reference for rhombohedral/scalenohedral forms. The historical
  morphological axial convention differs from the structural cell, as verified
  below; the PDF's extracted text also loses overbars.
* [Pyrite, version 1](https://www.handbookofmineralogy.org/pdfs/pyrite.pdf):
  supports cubic and pyritohedral habit identification; the indexed forms are
  independently supported by the research article below.
* [Anatase, version 1](https://www.handbookofmineralogy.org/pdfs/anatase.pdf):
  identifies dipyramidal forms and basal tabular habit.

These pages carry copyright notices. The
[Handbook home page](https://handbookofmineralogy.org/) directs reproduction and
online-content uses to the publisher's permissions policy. No PDFs, images or
copied descriptions have been added to the repository. Do not treat public
access as a redistribution license. Find a clearly compatible morphology source
or establish the permitted use before committing derived catalog content. If
owner action is needed, follow the concrete artifact/action request requirements
in [acquisition and licensing](../data-model.md#acquisition-and-licensing).

## Online parameter verification

Verified on 2026-09-16. Lengths below are in Å and angles in degrees.
These are source-specific reported values, not universal constants. Conventional
equal lengths and right angles implied by symmetry are expanded in the table.
ASCII minus signs in symmetry symbols represent crystallographic overbars.

| Mineral | Source and verification level | Cell `(a, b, c; alpha, beta, gamma)` | Symmetry and setting |
|---|---|---|---|
| Calcite | [COD 9000095](https://www.crystallography.net/cod/9000095.html), CIF inspected; Graf (1961), *American Mineralogist* 46, 1283–1316 | `(4.9900, 4.9900, 17.0615; 90, 90, 120)` | Trigonal, `R -3 c :H`, No. 167; point group `-3m`, hexagonal axes |
| Pyrite | [COD 9000594 CIF](https://www.crystallography.net/cod/9000594.cif), inspected; Bayliss (1977), *American Mineralogist* 62, 1168–1172, cubic model of weakly anisotropic pyrite | `(5.4166, 5.4166, 5.4166; 90, 90, 90)` | Cubic, `P a -3`, No. 205; point group `m-3` |
| Anatase | [COD 9015929 CIF](https://www.crystallography.net/cod/9015929.cif), inspected; Howard, Sabine and Dickson (1991), [DOI](https://doi.org/10.1107/S010876819100335X), synthetic sample | `(3.7845, 3.7845, 9.5143; 90, 90, 90)` | Tetragonal, `I 41/a m d :1`, No. 141, origin choice 1; point group `4/mmm` |
| Forsterite | [COD 9000319](https://www.crystallography.net/cod/9000319.html), CIF inspected; Smyth and Hazen (1973), *American Mineralogist* 58, 588–593, 25 °C | `(4.756, 10.207, 5.980; 90, 90, 90)` | Orthorhombic, `P b n m`, No. 62; point group `mmm`; retain this axis order |
| Beryl | [Handbook, version 1.2](https://www.handbookofmineralogy.org/pdfs/beryl.pdf), reference range only | `a=b=9.205–9.274`, `c=9.187–9.249`; `(90, 90, 120)` | Hexagonal, `P 6/m c c`, point group `6/mmm` |
| Gypsum | [Handbook, version 1](https://www.handbookofmineralogy.org/pdfs/gypsum.pdf), reference cell only | `(5.679(5), 15.202(14), 6.522(6); 90, 118.43, 90)` | Monoclinic, `I 2/a`, unique axis b; point group `2/m` |
| Low albite | [Handbook, version 1.2](https://www.handbookofmineralogy.org/pdfs/albite.pdf), reference cell only | `(8.137(1), 12.785(1), 7.1583(4); 94.26(1), 116.60(1), 87.71(1))` | Triclinic, conventional centered feldspar cell; pin explicit symmetry from an acquired CIF before implementation |

Do not choose independent endpoints of the beryl ranges as though they formed
one measured cell. Do not relabel forsterite's `Pbnm` cell as `Pnma`, gypsum's
`I2/a` cell as `C2/c`, or albite's conventional cell as primitive without a basis
transformation. Low and high albite are distinct source choices.

The handbook gives calcite `a=4.9896(2), c=17.0610(11)`, pyrite
`a=5.4179(11)`, and forsterite `(4.7540, 10.1971, 5.9806)`. These are different
reported datasets; do not attach their values to the acquired COD records.
Anatase's CIF agrees with the handbook cell, but gives the original paper's year
as **1991**, not the handbook's 1992. Record-specific measurement conditions must
remain unspecified when absent; do not infer room temperature from a mineral name.

### Acquired CIF integrity

Exact download URLs are `https://www.crystallography.net/cod/<ID>.cif`.
Revisions below come from the downloaded bytes, which can be newer than indexed
information cards. Local filenames are `<ID>.cif` in the temporary directory above.

| COD ID | CIF revision | SHA-256 |
|---|---|---|
| 9000095 | 301881 | `d8a1cf92866da8814ef104b1626117490d9d4fbad823ef5dbf1cd2954488da52` |
| 9000594 | 303136 | `0caef0969b6bcc5697310ab6f4316cbd01daf5fbcb7cfb1b5d6036647548a9d8` |
| 9015929 | 303136 | `9df468431a17fa7983e360aed53d9702ea53d7fa31a4a65012e54097daabcd0e` |
| 9000319 | 303136 | `550b8c89c617267d39e7cb6a07fe6f55cd2343453c1c45ec77738bf6fd25d9cd` |

COD publishes CC0 terms; these CIF headers also request attribution to the
original journal articles. Preserve that attribution in normalized records.
Raw CIFs have not been added to version control, and inspecting them does not
implement or claim the M6 CIF import capability.

### Verified habit indices

* **Calcite:** [Hazen, section 3.4, PDF page 11](https://hazen.carnegiescience.edu/sites/default/files/180-ChiralFaces2004.pdf)
  explicitly distinguishes the two axial conventions. The rhombohedral face is
  `(104)` and the scalenohedral face `(214)` in structural hexagonal axes;
  corresponding historical morphological indices are `(101)` and `(211)`.
  The printed page was visually checked. Four-index equivalents calculated using
  `i=-(h+k)` are `(1,0,-1,4)` and `(2,1,-3,4)`. This axial-convention conversion
  is separate from M5's hexagonal-to-rhombohedral primitive-cell conversion.
* **Pyrite:** [Arrouvel and Eon, *Understanding the Surfaces and Crystal Growth of Pyrite FeS2*, Figures 2–3](https://www.scielo.br/j/mr/a/WCvkdSk35gt6Kxbfw5JVJtH/?lang=en)
  identifies cubic `{100}` and pyritohedral `{210}` forms. The article explicitly
  permits reuse under Creative Commons Attribution with citation. Generate the
  latter with `m-3`; using the fluorite operation set would add unwanted faces.
* **Anatase:** the handbook supports dipyramidal `{011}` and tabular `{001}`
  habits. `{101}` is symmetry-equivalent to `{011}` under `4/mmm`. A basal form
  alone is unbounded; an ideal tabular preset needs enclosing side forms as well.

These references support habit families and plane indices, not numerical
development sliders. Development values remain curated visualization parameters.
This verification does not clear all remaining morphology redistribution questions.

## Remaining gate work

1. Obtain the owner's habit/fixture selection decision.
2. Pin beryl, gypsum and albite structural records and hashes; select the final
   source dataset for each mineral, preserving settings and sample conditions.
3. Finish morphology use-term checks; label development values as curated
   visualization choices. Calcite's historical index conversion is verified above.
4. Pin the symmetry entries, paired-setting transform and independent expected
   results for the fixtures before accepting coverage.

No new mineral record, habit or crystal-system coverage is claimed by this
checkpoint draft.

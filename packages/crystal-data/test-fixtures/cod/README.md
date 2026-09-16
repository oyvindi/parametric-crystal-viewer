# COD CIF regression fixtures

Downloaded directly from the Crystallography Open Database on 2026-09-16.
These are unmodified source fixtures for import/expansion tests, not additions to
the shipped mineral catalog. Original publication attribution and COD revision
headers are retained in each file.

COD states that its data and database are dedicated to the public domain under
[CC0](https://www.crystallography.net/cod/new.html). The individual AMCSD-derived
files also request attribution to their original publications; retain their
headers and publication metadata when redistributing these fixtures.

## Acquired records

| File | Source URL | COD revision | Original publication | SHA-256 |
|---|---|---|---|---|
| [9000775.cif](9000775.cif) | [Quartz](https://www.crystallography.net/cod/9000775.cif) | 291269 | Levien, Prewitt and Weidner (1980), Structure and elastic properties of quartz at pressure, American Mineralogist 65, 920–930; P = 1 atm | `573e4a570f2cf9e5c338cfb4f23c94fe6c6254de5ee90d9851204d912aa5ea48` |
| [9009005.cif](9009005.cif) | [Fluorite](https://www.crystallography.net/cod/9009005.cif) | 291735 | Wyckoff (1963), Crystal Structures, second edition, volume 1, 239–444; Fluorite structure | `af73721cefc54576ae01be1bd73ed7c71dba39de0d79ba72a7917f7fbf58c2cd` |

## Regression assertions

| Record | Case | Independent expected result from CIF formula and Z |
|---|---|---|
| Quartz 9000775 | Six screw-axis operations with fractional translations; special/general positions; gamma = 120 degrees; unrelated anisotropic-displacement loop; element inferred from site label | Si3 O6 (9 atoms), from SiO2 and Z = 3 |
| Fluorite 9009005 | 192 space operations, face-centering translations, strong special-position deduplication | Ca4 F8 (12 atoms), from CaF2 and Z = 4 |
| [Calcite 9000095](../../../crystal-core/test-fixtures/m5/9000095.cif) (existing) | Rhombohedral centering in a hexagonal cell; distinct special-position multiplicities | Ca6 C6 O18 (30 atoms), from CaCO3 and Z = 6 |
| [Pyrite 9000594](../../../crystal-core/test-fixtures/m5/9000594.cif) (existing) | Distinguish m-3 from m-3m; exact expansion and periodic connectivity | Fe4 S8 (12 atoms), from FeS2 and Z = 4 |
| [Albite 9000993](../../../crystal-core/test-fixtures/m5/9000993.cif) (existing) | Fully oblique cell, centered nonstandard triclinic setting, labelled sites with explicit element types | Na4 Al4 Si12 O32 (52 atoms), from NaAlSi3O8 and Z = 4 |

[Automated regression tests](../../src/cod-regression.test.ts) verify all five
formula/Z element counts, quartz screw-related silicon coordinates, fluorite
calcium and fluorine coordinates, special-position operation attribution, and
eight periodic nearest fluorine neighbours at sqrt(3)*a/4 around calcium.
These geometric checks are independent of inferred bond cutoffs.

Synthetic derivatives are generated in the tests without modifying downloaded
files. Multiplicity columns (quartz Si: 3, O: 6; fluorite Ca: 4, F: 8) must leave
the complete expansion unchanged. A fluorite nanometre derivative must produce
the same lattice, volume, Cartesian atom positions and nonempty periodic bond
list as the original angstrom input. Floating-point comparisons use tolerances.
Original source units remain in provenance; normalized unit cells use angstrom.

Also retain targeted synthetic fixtures for equivalent angstrom/nanometre inputs,
malformed and conflicting descriptions, and periodic-boundary tolerance cases.
A real partially occupied/disordered record remains a useful future acquisition;
none of the new files is claimed to cover that case.

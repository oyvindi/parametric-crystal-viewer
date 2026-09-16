# M5 Multiple Crystal Systems Acceptance

M5 is complete. This audit covers the [M5 criteria](plan.md#m5--multiple-crystal-systems)
and the [coverage matrix](plan.md#mineral-and-crystal-system-coverage). The
[M5 acquisition record](sources/m5-acquisition.md) is the source history; this
audit consolidates the delivery, provenance, fixture, and demo evidence.

## Shipped minerals

| Shipped mineral | Records and habits | Crystallography | Provenance |
|---|---|---|---|
| Calcite | [record](../packages/crystal-data/src/minerals/calcite.ts), `m5-1`; rhombohedral and scalenohedral habits | Trigonal, `R-3c`, point group `-3m`, hexagonal axes; COD 9000095 | Reported crystallography (COD CC0); reported morphology forms (CC-BY); curated development |
| Pyrite | [record](../packages/crystal-data/src/minerals/pyrite.ts), `m5-1`; cubic and pyritohedral habits | Cubic, `Pa-3`, point group `m-3`; COD 9000594 | Reported crystallography; reported morphology forms (CC-BY); curated development |
| Anatase | [record](../packages/crystal-data/src/minerals/anatase.ts), `m5-1`; dipyramidal and tabular habits | Tetragonal, `I41/amd`, point group `4/mmm`; COD 9015929 | Reported crystallography; reported morphology forms; curated development |

The three records use `defineMineral` and the permanent [M4 validation path](m4-acceptance.md);
no mineral-specific generator logic was added to `crystal-core`. Each record carries
traceable references, distinguished reported crystallography from curated development
values, and passes core geometry validation for every habit. The [M5 mineral tests](../packages/crystal-data/src/m5-minerals-acceptance.test.ts)
verify stable identity, catalog registration, reference traceability, provenance
status, registry order, valid habit geometry, visibly different habits, secondary-form
enabling, and the all-forms-disabled diagnostic.

Pyrite uses the `m-3` registry entry, not fluorite's `m-3m`, so pyritohedral `{210}`
generates the correct face set without unwanted additional faces. Anatase's tabular
habit encloses the basal form with side forms, since a basal form alone is unbounded.

## Crystal-system fixtures

Eight setting-specific point-operation registry entries were generated from the
pinned spglib source and committed under [registry/](../packages/crystal-core/src/registry/),
covering trigonal `-3m`, cubic `m-3`, tetragonal `4/mmm`, hexagonal `6/mmm`,
orthorhombic `mmm`, monoclinic `2/m`, and triclinic `-1`. The [M5 acceptance tests](../packages/crystal-core/src/m5-acceptance.test.ts)
verify deep immutability and artifact integrity hashes.

Seven pinned COD CIFs under `packages/crystal-core/test-fixtures/m5/` provide the
engine fixtures (content-verified, SHA-256 pinned in [M5 acceptance tests](../packages/crystal-core/src/m5-acceptance.test.ts)):

| Crystal system | Fixture | COD ID | Point group | Setting | Operation order |
|---|---|---|---|---|---|
| Trigonal (shipped) | Calcite | 9000095 | `-3m` | hexagonal-standard | 12 |
| Cubic (shipped) | Pyrite | 9000594 | `m-3` | cubic-standard | 24 |
| Tetragonal (shipped) | Anatase | 9015929 | `4/mmm` | tetragonal-standard | 16 |
| Hexagonal | Beryl | 9001551 | `6/mmm` | hexagonal-standard | 24 |
| Orthorhombic | Forsterite | 9000319 | `mmm` | orthorhombic-standard | 8 |
| Monoclinic | Gypsum | 9013164 | `2/m` | monoclinic-b | 4 |
| Triclinic | Albite | 9000993 | `-1` | triclinic-standard | 2 |

For each fixture, the tests reproduce the published cell volume and fractional
metric, validate the independently sourced CIF space operations against the registry
entry (group laws, metric compatibility, explicit/registry equivalence), generate
enclosing forms with equal explicit/registry geometry, and confirm reciprocal-lattice
face normals. The four test-only minerals do not count toward shipped catalog coverage.

## Paired trigonal-setting fixture

The paired calcite fixture is in the [M5 acceptance tests](../packages/crystal-core/src/m5-acceptance.test.ts).
It represents one sourced hexagonal definition in both hexagonal and rhombohedral
settings with an explicit basis transform `P` (primitive obverse R translations)
and its inverse. The tests verify:

* a 3:1 hexagonal-to-rhombohedral cell-volume relationship;
* equivalent metrics after the transform (`Pᵀ H P = R`);
* a proper orthogonal frame rotation `Q` between the two canonical Cartesian frames;
* converted point operations match the rhombohedral registry set;
* matching Cartesian plane directions, centered vertices, and face areas for the
  `{104}` and `{214}` reference planes; and
* rejection of four-index planes in primitive rhombohedral axes, mismatched settings,
  and conflicting explicit operations.

This supplements M3 quartz coverage; it does not define another shipped mineral.

## Multi-mineral demo

The [minerals demo](../packages/crystal-demo/minerals.html) provides mineral and
habit selection with visible crystal-system, point-group, setting, and space-group
information. Variant selection (left/right quartz), synchronized form sliders with
numeric readouts, face labels, face inspection, camera reset, and geometry status
are all present. Controls update when the selected record, variant, or habit changes.
The earlier fluorite and quartz demos remain runnable.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
```

Verification passed: 215 tests across 13 test files, the TypeScript workspace build,
package dependency checks, and documentation links/anchors/code fences. The suite
includes the 27-test M5 core fixture suite, the 33-test M5 mineral suite, and the
existing core/data/viewer/renderer tests.

M5 is next-to-last before structural data: M6 adds CIF import, atomic structure
expansion, periodic bond resolution, and atomic-structure rendering under the
[V1 import boundary](data-model.md#v1-import-boundary).

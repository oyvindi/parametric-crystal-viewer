# Crystal data

This package owns the version-controlled mineral catalog, record validation and
normalization, habit and variant resolution, and conversion to generic core inputs.
The scientific contracts remain in the [data model](../../docs/data-model.md).
Exact public types are in [types.ts](src/types.ts) and emitted declaration files.

## Loading and validation

`validateMineral(unknown)` returns the shared core `Result<Mineral>` envelope.
`defineMineral(unknown)` and `loadMineral(source)` throw `MineralDataError` with
structured diagnostics on rejection. Loading accepts a bundled ID or an object;
parse JSON text before supplying it. Both paths use the same validator.

Successful records are detached, deeply frozen snapshots. Reusing an already
validated snapshot avoids repeated validation. Caller mutation cannot change a
catalog entry or a loaded viewer. `createMineralCatalog(records)` builds an isolated
catalog atomically, rejecting duplicate mineral IDs; it does not mutate the bundled
catalog. `getMineral` returns `undefined` for a missing ID; `loadMineral` reports a
typed error instead.

The M4 schema covers morphology records: stable identity and data revision,
crystallography, at least one described habit with forms, optional structural
variants, references, and provenance. Unsupported fields are rejected. Atomic and
CIF definitions are added in M6; state-format and compatibility decisions remain
in M7. A revision identifies the record contents; it is not a state-format version.

Validation checks record shapes, unique IDs within collections, reference resolution,
provenance origins and coverage, and preferred-view vectors. Scientific validation
delegates to core lattice/symmetry and morphology validation without generating a
polyhedron. Thus disabled or non-enclosing form combinations remain valid record
inputs and produce geometry diagnostics when rendered. Shipping a *completed habit*
still requires the separate [habit acceptance checks](../../docs/data-model.md#completed-habit-presets).

The normalized-record default length unit is Ångström. Explicit nanometres are
converted to Ångström and the original unit is retained in `sourceLengthUnit`.
Unknown units are rejected. Importers must establish source units before using this
boundary. Both the default crystallography and all variants follow the same rules.

## Provenance representation

Coverage strings are dotted paths into the record. A group path covers its
descendants; `*` matches array elements, and numeric array indices can identify an
individual item. Coverage must resolve to existing data. All crystallography fields
and habit indices, development values, and explicit enabled flags require coverage.
Grouped and individual-field coverage are both supported.

Root references need a title, URL, or DOI. Habit and variant references may use an
ID resolving to a root reference or include their own traceable description.
Provenance reference IDs resolve to root references. Reported entries need source
references; curated and estimated entries need an origin statement in `derivation`;
derived entries need a method and source references to the inputs. Fully curated
provisional records may have an empty reference list. Runtime validation checks
metadata integrity; it cannot establish whether a publication scientifically
supports a claim. That remains part of acquisition and milestone review.

## Adding a record

1. Acquire and document sources under the [acquisition contract](../../docs/data-model.md#acquisition-and-licensing).
2. Add a record under `src/minerals/`, using `defineMineral` to validate it. Supply a
   stable ID and update the data revision when the record changes.
3. Export and include it in `src/catalog.ts` for bundled loading, or pass a provisional
   record directly to `loadMineral` or the viewer.
4. Test its habits and scientific reference results through `createCrystalInput`
   and core `generateCrystal`. No mineral-specific core generator is needed.

`createCrystalInput` validates its record, resolves a habit and optional variant,
and applies development/enabled overrides without modifying the preset. Unknown
habit, variant, or form IDs produce typed diagnostics. Numeric override validity
continues to be reported by core generation, preserving the viewer's invalid-edit
and recovery behavior.

## Diagnostics

Exact code names are enumerated in [diagnostics.ts](src/diagnostics.ts).

| Code | Meaning |
|---|---|
| `data.record.invalid-field` | Missing, malformed, or unsupported schema field |
| `data.record.duplicate-id` | Duplicate record or collection identity |
| `data.record.invalid-reference` | Untraceable or unresolved source reference |
| `data.record.invalid-provenance` | Missing origin, input reference, or field coverage |
| `data.record.invalid-preferred-view` | Invalid or parallel camera/up vectors |
| `data.catalog.unknown-mineral` | Catalog ID not found |
| `data.request.unknown-habit` | Habit ID not found |
| `data.request.unknown-variant` | Variant ID not found |
| `data.request.unknown-form` | Override targets an unknown form |

Scientific failures retain `core.*` codes. Record validation maps their paths to
the affected record or variant. Callers branch on codes, not messages. Tests cover
deterministic diagnostics, normalized units, metadata validation, immutable loading,
and shipped/provisional records through the same core boundary.

# `@crystal/core`

Renderer-neutral crystallographic calculations and generated geometry.

## Public input

`generateCrystal(crystallography, morphology)` validates a unit cell, explicit or
registry symmetry, and generic form settings before generating geometry. Exact
interfaces are exported from `src/index.ts` and emitted in `dist/*.d.ts` by the
build. `generateCrystalGeometry` accepts an already constructed lattice;
`intersectHalfSpaces` is the origin-centered non-negative-support primitive.

The public generator positions morphology at the geometric unit-cell center in
Ångström. Forms have stable unique IDs; omitted `enabled` means true. Disabled
and zero-development forms are omitted, while their scientific inputs are still
validated. M1 geometry accepts three-index Miller notation; setting-aware
Miller–Bravais expansion remains M3 work.

The supported lookup is point group `m-3m`, setting `cubic-standard`, crystal
system `cubic`. Explicit point or space operations use the supplied cell basis;
space translations are validated modulo lattice translations and discarded only
when deriving point operations for morphology. Unsupported identifiers are
errors even when explicit operations accompany them.

## M1 diagnostic codes

| Code | Meaning |
|---|---|
| `core.input.invalid-unit-cell` | Cell dimensions or angles are invalid or degenerate. |
| `core.input.invalid-miller-indices` | Indices are non-integral, zero, incompatible, or cannot be transformed. |
| `core.input.invalid-development` | Form development is non-finite or outside `[0, 1]`. |
| `core.input.invalid-morphology-scale` | Morphology scale is non-finite or non-positive. |
| `core.input.invalid-half-space` | A half-space normal or distance is invalid. |
| `core.input.invalid-form` | Form ID or enabled flag is invalid. |
| `core.input.invalid-crystallography` | Crystal system is unknown. |
| `core.symmetry.empty-operations` | Explicit operation set is empty. |
| `core.symmetry.invalid-operation` | IDs, matrices, or translations are invalid. |
| `core.symmetry.metric-incompatible` | Operation does not preserve the cell metric. |
| `core.symmetry.missing-identity` | Operation set lacks identity. |
| `core.symmetry.missing-inverse` | Operation set lacks an inverse. |
| `core.symmetry.not-closed` | Composition is absent from the operation set. |
| `core.symmetry.missing` | No explicit or supported registry symmetry. |
| `core.symmetry.conflicting-descriptions` | Supplied descriptions disagree. |
| `core.symmetry.unsupported-registry` | Identifier or setting is unsupported/ambiguous. |
| `core.geometry.no-active-forms` | No form has positive development. |
| `core.geometry.unbounded` | Normals admit a non-zero recession direction. |
| `core.geometry.degenerate` | Constraints enclose zero usable three-dimensional volume. |
| `core.geometry.numerical-failure` | Reliable finite geometry or topology could not be computed. |
| `core.geometry.redundant-form` | Warning: an active form contributes no visible face. |

Errors prevent geometry from being returned. Validation collects independent
issues in field/input order; group-law checks use operation order. Warnings can
accompany valid geometry. Hosts should branch on codes rather than messages.
Face contributors are sorted by form ID and retain sorted unique operation IDs
and oriented indices. Face/vertex indices are deterministic for the same input
set, but are not persistent identities across topology changes.

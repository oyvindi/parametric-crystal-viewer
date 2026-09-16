# M1 Acquisition and Licensing Record

This record satisfies the M1 [data acquisition checkpoint](../plan.md#data-acquisition-checkpoint). It is limited to the cubic symmetry-operation registry subset and the lattice fixtures needed before the first prototype. Mineral records are not part of M1.

## Symmetry-operation registry

| Field | Record |
|---|---|
| Source | [spglib](https://github.com/spglib/spglib), `v2.7.0` |
| Pinned identity | Git tag commit `12355c77fb7c505a55f52cae36341d73b781a065` |
| License | [BSD-3-Clause](https://github.com/spglib/spglib/blob/v2.7.0/COPYING) |
| Required artifact | A source-verified, generated cubic point-operation subset at `packages/crystal-core/src/registry/` |
| Intended redistribution | Commit only the normalized subset and its source attribution; retain the BSD-3-Clause copyright and license notice with any copied or derived operation data. |
| Normalization | Convert the source integer rotation matrices into this project's row-major `Mat3` representation, preserving the source's active fractional-coordinate action `x' = W x + t`. Strip translations only when deriving point operations for morphology. |
| Integrity checks | Verify the source tag commit above before regenerating; hash each generated registry artifact with SHA-256 and record it beside the artifact. Validate identity, closure, inverses, and metric compatibility in core tests. |

Spglib publishes symmetry operations as a rotation matrix and translation vector acting on a fractional-coordinate column, which matches the operation representation defined in the [scientific model](../scientific-model.md#operation-representation). Its documentation identifies the project as BSD-3-Clause licensed and its operation API uses the same `W x + w` convention. No account, click-through license, paid access, or manual download is required.

## Lattice reference fixtures

The initial cubic, orthorhombic, monoclinic, and triclinic fixtures are mathematical reference cases derived directly from the coordinate equations in the [scientific model](../scientific-model.md#coordinate-and-lattice-conventions). They are test inputs rather than acquired scientific records and have no external artifact to redistribute. The model's cited [IUCr matrix reference](https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry) remains the reference for crystallographic matrix conventions.

## Acquired and verified M1 artifacts

Verified on 2026-09-16. The GitHub tag API resolves `v2.7.0` to the commit above.
The exact upstream record is Hall number **517**, space group **221** (`P m-3m`),
conventional cubic axes and origin at the symmetry center. Its 48 linear
operations provide the `m-3m` point-group subset; no space-group registry lookup
is claimed by M1.

* Input: [`src/spg_database.c` at v2.7.0](https://github.com/spglib/spglib/blob/v2.7.0/src/spg_database.c).
* Input SHA-256: `bf1ab8a74e1d275e20ee4145bd409b62b5295e680599d3a112a41d396bde56bd`.
* Generator: [generate-m1-registry.mjs](../../scripts/generate-m1-registry.mjs).
  It verifies the source hash, extracts Hall 517's operation range, decodes
  base-three rotation entries in row-major order, discards translations, and
  verifies equivalence with the prototype's signed-permutation ordering so
  existing operation IDs remain unchanged.
* Committed subset: [cubic-operations.ts](../../packages/crystal-core/src/registry/cubic-operations.ts).
* Subset SHA-256: `5d2dd018ceef366ecf5018a1f6374a31d92aff61f28f7f8c29f546a9663d5665`.
* Machine-readable integrity: [integrity.ts](../../packages/crystal-core/src/registry/integrity.ts).
* Retained license: [LICENSE.spglib](../../packages/crystal-core/src/registry/LICENSE.spglib).
  The source database also carries `Copyright (C) 2010 Atsushi Togo` and
  `SPDX-License-Identifier: BSD-3-Clause`; these notices are retained here.

Regenerate offline with `node scripts/generate-m1-registry.mjs /path/to/spg_database.c`.
Append `--check` to compare both generated files without editing. The full
upstream database is an acquisition input and is not committed.

The additional prism, cube, octahedron, affine-translation, and large-plane
fixtures are synthetic mathematical constructions, not measured mineral data.
Their construction is committed in the acceptance tests and benchmark script.
The cell cases do not count toward M5's sourced mineral fixture coverage.

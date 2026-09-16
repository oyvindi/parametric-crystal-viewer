# M1 Acquisition and Licensing Record

This record satisfies the M1 [data acquisition checkpoint](../plan.md#data-acquisition-checkpoint). It is limited to the cubic symmetry-operation registry subset and the lattice fixtures needed before the first prototype. Mineral records are not part of M1.

## Symmetry-operation registry

| Field | Record |
|---|---|
| Source | [spglib](https://github.com/spglib/spglib), `v2.7.0` |
| Pinned identity | Git tag commit `12355c77fb7c505a55f52cae36341d73b781a065` |
| License | [BSD-3-Clause](https://github.com/spglib/spglib/blob/v2.7.0/COPYING) |
| Required artifact | A hand-reviewed, normalized cubic point-operation subset at `packages/crystal-core/src/registry/` |
| Intended redistribution | Commit only the normalized subset and its source attribution; retain the BSD-3-Clause copyright and license notice with any copied or derived operation data. |
| Normalization | Convert the source integer rotation matrices into this project's row-major `Mat3` representation, preserving the source's active fractional-coordinate action `x' = W x + t`. Strip translations only when deriving point operations for morphology. |
| Integrity checks | Verify the source tag commit above before regenerating; hash each generated registry artifact with SHA-256 and record it beside the artifact. Validate identity, closure, inverses, and metric compatibility in core tests. |

Spglib publishes symmetry operations as a rotation matrix and translation vector acting on a fractional-coordinate column, which matches the operation representation defined in the [scientific model](../scientific-model.md#operation-representation). Its documentation identifies the project as BSD-3-Clause licensed and its operation API uses the same `W x + w` convention. No account, click-through license, paid access, or manual download is required.

## Lattice reference fixtures

The initial cubic, orthorhombic, monoclinic, and triclinic fixtures are mathematical reference cases derived directly from the coordinate equations in the [scientific model](../scientific-model.md#coordinate-and-lattice-conventions). They are test inputs rather than acquired scientific records and have no external artifact to redistribute. The model's cited [IUCr matrix reference](https://www.iucr.org/what-we-do/education/pamphlets/matrices-mappings-and-crystallographic-symmetry) remains the reference for crystallographic matrix conventions.

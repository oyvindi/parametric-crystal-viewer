# SR10 edge and corner growth experiment

**Status:** integrated into the accepted Terraced fluorite preset on 2026-09-20. The
prototype was authorized following the
[union comparison feedback](sr10-boolean-design.md#owner-feedback) and received
[owner visual approval](#owner-review). The cross-face operands are now part of the
production display-growth pipeline. The [scientific model](scientific-model.md),
[architecture](architecture.md), and [viewer API](viewer-api.md) remain authoritative.

## Shape and operand placement

Keep the accepted core and all 486 seeded children. Add six separate, shallow,
axis-aligned blocks along each of the twelve cube edges, plus one at each of the
eight corners. Each block overlaps the core by positive volume. Its exposed heights
match the nearby child-growth heights on its two or three incident faces. Placement
and embedded widths vary deterministically with the display seed. Along an edge,
leave gaps between successive blocks so the additions cannot become one constant
strip. The blocks retain right-angle cubic steps; there is no bevel, diagonal bridge,
rounded fillet, or subtraction from the core.

These are rectangular cubic-growth blocks, consistent with the accepted operands;
“low height” does not mean an equal-sided cube centered on the original edge. Most
of each block remains embedded. Neighbor heights come from the nearest child
footprints to the chosen edge/corner location; equally near candidates choose the
highest local surface. This reads the generated geometry, not mineral data or a
specimen image. All placement constants are curated experiment parameters.

## Constrained union extension

Pass the additional operands separately to the existing experimental union. Keep
its original face-local validation unchanged. Additional operands must cross exactly
two or three incident core faces, overlap the core with positive volume, extend by
at most 6% of the core side beyond any crossed face, and span at most 22% of the core
side along any axis. Reject detached solids, opposite-face crossings, invalid face
attribution, and non-manifold results. Allow at most 128 additional operands, retaining
the original 512-operand limit for the face-local input and the existing output limits.

The union retains its existing Float64 numerical policy, clipping, edge subdivision,
watertightness and deterministic ordering checks. This is a separate experiment with
additional operands, not a relaxation of the accepted generator's footprint checks.

## Core-face provenance

For each additional block, identify the incident original core faces from the planes
it crosses. An outward block face parallel to one of those incident core-face normals
inherits that face index. Every other block face (including edge end caps and embedded
back faces) inherits the lowest incident core-face index. This explicit tie-break is a
curated inspection rule, not a new crystallographic measurement. It is stable for the
same core geometry, not a persistent identity across morphology edits.

Apply this rule before clipping. Every split inherits its operand-face attribution;
coplanar ownership uses the union's deterministic ordering, with the scientific core
first. Every resulting triangle still reports only an originating core face. There
is no public edge, corner, child, or other display-feature identity. Existing surface
profiles remain unmapped. Scientific normals and contributors remain those of the core.

## Isolation and evidence

Add an unexported renderer-neutral module and a `corners` choice only in the isolated
review bundle. Production viewer dispatch, serialized modes, exports and baseline
remain unchanged. Rebuild the existing review directory so the current local server
can serve the new comparison immediately. Link accepted, union-only, corner-growth
union and idealized scenes with identical camera, material and lighting.

Test the operand limits, deliberate gaps, local height matching, full-field Float64
and centered Float32 topology, immutable source geometry, byte-identical regeneration
and reordered inputs, provenance before and after clipping, and existing resource
replacement/disposal using test-only substitution. Compare fixed transmission,
rotated and opaque scenes, retaining repeat captures. Owner review decides whether
the new blocks interrupt the straight corner sufficiently without creating a frame.

## Prototype results

The [operand generator](../packages/crystal-three/src/corner-growth.ts)
and [extended union](../packages/crystal-three/src/box-union.ts) are exported from
the `crystal-three` package entry point. The original union-only result is unchanged when additional operands are
omitted. The pinned corner-growth field has 567 input solids, then one closed output
component with 5,432 boundary rectangles and 27,842 triangles. Result position and
attribution buffers occupy 2,115,992 bytes, excluding intermediate allocations and GPU
resources. Four local browser generation/validation measurements were 422–458 ms;
this remains an experiment with unresolved interactive performance cost.

[Tests](../packages/crystal-three/src/corner-growth.test.ts) verify that
all 80 blocks overlap the core, cross the intended two or three faces, stay within
the size envelope, and use existing neighboring height planes. All twelve edges have
six separate blocks with a gap greater than 1.5% of the core side between successive
edge blocks. Corner blocks may overlap the end blocks. Tests also verify exact
per-operand-face attribution, attribution of surviving exterior corner triangles,
byte identity after operand reordering, immutable inputs, and explicit rejection of
invalid extra operands. The original face-local path still rejects crossing operands.

The pinned scene passes Float64 and centered Float32 topology. Twelve additional
Float64 samples (seeds `0`, `1`, `2`, `0xffffffff`, morphology scales `0.001`, `1`,
`1000` Å) all pass. Float32 checks pass for all twelve samples including `0.001`,
since the GPU converter now centers Float64 positions before casting to Float32.
The existing viewer lifecycle test exercises the production display-growth path,
including seed/mode/mineral replacement, inspection, profile-zero routing, and
resource disposal.

The review harness captured accepted, union-only, and corner-growth views during
the spike. On the same pinned Chrome/platform, accepted capture remained
byte-identical to the committed SR10 baseline. Repeated captures were byte-identical.

| Corner growth versus union-only | Pixels with any RGB change | Whole-image mean absolute RGB difference (0–255) |
|---|---:|---:|
| Pinned transmission | 38,625 (5.588%) | 0.93023 |
| Rotated transmission | 39,138 (5.662%) | 0.95765 |
| Opaque control | 23,037 (3.333%) | 0.39219 |

These measurements established a repeatable visual change during the spike.
Unlike union-only cleanup, the corner-growth operands deliberately change the outer
envelope. The idealized scientific core and public API remain unchanged.

## Owner review

On 2026-09-20, after reviewing the new corner-growth version, the owner stated:
"this looks perfect!" This approves the visual direction of the shallow, staggered
edge/corner growth treatment. The treatment is now integrated into the accepted
production preset, and the pinned baseline has been regenerated to reflect it.

## Reproduce

```sh
npm run build
npm run baseline:sr10
```

`npm run check` passes with **524 tests in 39 files**. Documentation links/anchors
and `git diff --check` pass. The corner treatment is integrated into the accepted
production preset.

# SR10 constrained boolean-composition spike

**Status:** implementation design for an isolated experiment, 2026-09-20. Not an
accepted preset or public API. The [accepted SR10 slice](sr10-acceptance.md),
[scientific model](scientific-model.md), [architecture](architecture.md), and
[deferred follow-up](surface-rendering-plan.md#deferred-follow-up--boolean-composed-display-surface)
remain authoritative. This note is written before prototype implementation.
The later [edge/corner experiment](sr10-corner-growth-design.md) is separately
authorized for prototyping; the union-only findings here remain unchanged.

## Supported input and isolation

Evaluate only an axis-aligned convex cube with six square cube-form `a` / `{100}`
faces and the current face-local child solids. The accepted generator calls them
cubic growth, but their square footprint and outward height differ: the operands
are rectangular prisms, not equal-sided cubes. Consume their existing triangles;
do not change their seeded placement or dimensions. Require a closed box core and
closed box children, a single valid originating core face per child, positive-volume
attachment through that face, and footprints contained within its bounds. Reject
rotated boxes, truncated habits, detached/tangent-only children, ambiguous provenance,
cross-face footprints, and non-box meshes. No bridge, bevel, etching, or edge-spanning
operand is introduced.

Keep the experiment in an unexported `crystal-three` experimental module. Its runtime
must import neither Three.js nor browser APIs. Tests and a separate local review
harness may consume it; production viewer dispatch, state and preset exports remain
unchanged. The scientific core is read-only, including bounds, normals, contributors,
inspection and default export. Do not add a CSG dependency.

## Boundary construction and provenance

Use analytic orthogonal rectangle subtraction, avoiding a full three-dimensional
voxel grid. Each of the six faces of each box starts as an oriented rectangle tagged
with its originating core face. Clip away portions covered on the outward side by
other boxes. Remove touching opposing faces as internal boundaries. Resolve duplicate
coplanar surfaces in a canonical order: core first, then core-face index and box
coordinates. Every retained fragment inherits its source tag through every split;
no nearest-face inference or public operand identity is needed.

Rectangle subtraction alone creates T-junctions. Collect rectangle endpoints on each
axis-aligned edge line, split each collinear edge at every incident endpoint, then
triangulate each rectangle by a center fan. The fan accommodates arbitrary boundary
subdivisions without zero-area triangles. Stable box, face, fragment and edge orders
must give byte-identical Float64 positions and Uint32 core-face attribution for the
same operands, including reordered child operands. This is intentionally a simple
prototype; do not optimize away provenance boundaries or merge coplanar polygons yet.

## Numerical policy and rejection

Work in Float64 coordinates relative to the core minimum and divided by its side.
Accept only axis-alignment roundoff within `2e-12` normalized units. Canonicalize
near-equal coordinate values against the smallest value of each cluster, never a
transitive tolerance chain. This is a bounded roundoff correction to derived display
operands, not a modification to the core. Reject distinct coordinate separations
below `1e-9` after canonicalization rather than silently merging thin features.
Reject non-finite inputs, collapsed extents, incorrect winding, and unreliable output.
Use separate area (`1e-20`) and volume (`1e-12`) thresholds in normalized units.

Cap operands at 512, retained rectangles at 100,000 and output triangles at 250,000;
return a deterministic budget diagnostic before exposing partial output. These are
experimental work limits, not production performance promises. Expected failures use
the shared diagnostic envelope with experimental `three.display-union.*` codes for
unsupported input, provenance, footprint, numerical resolution, budget, and topology.
A rejected result has no display mesh and cannot replace a viewer resource.

## Component and resource semantics

All supported children overlap the core by positive volume; successful output is one
connected solid boundary. Require nonempty finite triangles, valid face indices,
nonzero area, exactly two oppositely oriented incidences per welded edge, a connected
triangle graph, a single cyclic link at every vertex, and positive signed volume.
The supported attachment class has no enclosed cavities; check Euler characteristic
2 as an additional guard. Edge counts alone do not prove a manifold.

Return the existing renderer-neutral display representation, with one component and
per-triangle core-face indices. Only the existing GPU converter may create Three.js
buffers; existing surface profiles remain zero/unmapped. A review harness owns its
experimental resource replacement and disposal. No public viewer injection hook or
serialized experimental mode is added. Test repeated conversion/disposal and preserve
the existing viewer lifecycle tests. Check Float32-converted topology separately for
reviewed scenes; Float64 success is not a guarantee against GPU precision collapse.

## Evidence and review gates

Test analytic box unions, touching/overlapping/coplanar arrangements, rejection of
unsupported or ambiguous inputs, deterministic byte identity, per-fragment source
provenance, immutable inputs, and the current 486-child seeded field. Independently
compare boundary area/volume and ray crossings with the input boxes where practical.
Record counts, time and output size rather than assuming union reduces triangle count.

Compare the accepted pinned scene and experimental boundary with the same camera,
environment, material and transmission, plus opaque and rotated views. Keep local
captures out of the accepted baseline directory. Verify the accepted baseline remains
unchanged. A cleaner external boundary does not establish improved transmission:
the current renderer's [screen-space approximation](decisions/0009-transmission-and-optical-refinement.md)
remains in force. No cube-edge softening is expected from these operands.

Owner review must separately decide whether the visual change is desirable and whether
performance and supported-input limits justify integration. Edge-spanning operands
remain a separate blocking design question. A general CSG dependency still requires
review of determinism, watertightness, generated provenance, runtime/WASM and bundle
cost, licensing, and package boundaries. The spike may support this constrained path,
justify a dependency evaluation, or leave the follow-up deferred; it cannot accept it.

## Spike results

**Disposition: supports a dependency-free constrained path; production follow-up
remains deferred.** No general CSG dependency evaluation is needed to continue this
specific experiment. No accepted geometry generator, viewer dispatch, state, mineral
data, inspection API, or baseline file changed. No user-supplied image was used.

The [prototype](../packages/crystal-three/src/experimental/box-union.ts) implements
the design above. It consumes component buffers (the redundant flattened input
buffers are not used), normalizes only derived copies, and returns no geometry on
rejection. Exact experimental signatures and diagnostic codes live in that module;
they are not exported from the package entry point. Its imports are type-only.

### Geometry evidence

The pinned seed `0x5f3759df` produces these results:

| Measurement | Accepted operands | Experimental union |
|---|---:|---:|
| Solid components | 487 (core plus 486 children) | 1 |
| Triangles | 5,844 | 24,044 |
| Surviving boundary rectangles | Not applicable | 4,685 |
| Unique result position/attribution buffer bytes | Not measured | 1,827,344 |

The extra triangles arise from rectangle fragmentation and conforming center fans.
Removing buried surfaces does not imply fewer triangles. The result buffers share
storage with the single component; the byte count excludes intermediate allocations,
GPU attributes and source operands.

The [geometry tests](../packages/crystal-three/src/experimental/box-union.test.ts)
verify oriented edge incidence, connected boundary, cyclic vertex links, Euler
characteristic, positive volume, finite/nondegenerate triangles, immutable core and
input components, and byte-identical positions and attribution when children are
reordered. An independent occupancy-cell calculation verifies analytic unions with
buried/duplicate children, overlapping and coplanar faces, face contact, and adjacent
fields at edges and corners. Exterior probes and operand-plane containment check
per-triangle provenance on split fixtures. An independent maximum-height integral
agrees with the full pinned field's volume and exterior area to eight decimal places.

The pinned field also passes topology after the existing Float32 GPU conversion and
centering. Twelve additional cases use seeds `0`, `1`, `2`, `0xffffffff` at morphology
scales `0.001`, `1`, `1000` Å. These samples all succeed; this is not an exhaustive
seed or numerical-envelope guarantee. Reject tests cover non-box data, invalid
provenance, non-finite and unresolved coordinates, boundary-crossing footprints,
attachment without volume overlap, excess operands, and children that touch along a
non-manifold edge. There is no silent approximation fallback.

The [viewer test](../packages/crystal-viewer/src/sr10-union-spike.test.ts) substitutes
the generator only within Vitest. It confirms unchanged face inspection/core state,
no surface-profile mapping, and disposal of experimental geometry and materials on
seed, mode, mineral and viewer replacement. Production viewer behavior is unchanged.

### Rendering evidence

The [review harness](../scripts/review-sr10-boolean.mjs) makes an isolated Vite bundle
with a build-time substitution, without editing application sources or adding a
public injection API. It reuses the accepted scene, the existing GPU conversion and
viewer, and captures accepted, union and idealized views under pinned transmission,
a fixed extra rotation `[0.31, 0.58, 0.17]`, and an opaque control. Repeated captures
check determinism. All outputs are ignored under `artifacts/sr10-boolean/`.

On 2026-09-20, Chrome 152.0.7977.82 / Node 26.8.1 / Linux x64 reproduced the
committed accepted PNG byte-for-byte. Repeated accepted and union PNGs were also
byte-identical. The union PNG SHA-256 was
`fc4520c1d196e6ae97c51d0e9e19631a523aac449c18fe5ff4f119ccbca27f26`.

The same 960×720 camera, project-owned studio environment, exposure 1, AgX tone
mapping, disabled surface detail, and fluorite material were used. Effective
transmission was `0.8`, roughness `0.08`, IOR `1.434`, absorption density `0.5`.
The opaque control overrides only transmission to `0`.

| Union versus accepted | Pixels with any RGB change | Whole-image mean absolute RGB difference (0–255) |
|---|---:|---:|
| Pinned transmission | 130,934 (18.943%) | 0.26957 |
| Rotated transmission | 141,371 (20.453%) | 0.33672 |
| Opaque control | 5,014 (0.725%) | 0.01511 |

These are difference measurements, not perceptual improvement scores. Most of the
measured change occurs in transmissive scenes; triangulation and rasterization also
change some opaque pixels. No assistant visual acceptance is claimed. The
[owner feedback](#owner-feedback) does not establish an improvement in corner
appearance. The same physical right-angle cube boundary remains; these operands
cannot smooth it.

Four browser measurements of union generation plus Float64 validation were
351–383 ms, excluding accepted-operand generation, GPU conversion and rendering.
They are local observations rather than a portable performance budget. This cost
and the approximately 4.1× triangle count block treating the current implementation
as ready for interactive replacement. No frame-rate or peak-memory claim was tested.

### Owner feedback

On 2026-09-20 the owner reported that the comparison looks very similar to the
previous version, with very pronounced corners, and supplied a viewer screenshot
with one side highlighted for clarity. The long, straight junction between adjacent
face-local growth fields remains conspicuous. The screenshot was reviewed in the
conversation only; it is not a committed artifact or mineral-data evidence.

This feedback leaves the corner-appearance problem unresolved and supplies no visual
acceptance for replacing the accepted preset. It does not separately establish whether
removing internal surfaces is useful for transmission. A union of the same operands
preserves their exterior envelope; topology cleanup alone cannot change that junction.

Changing the corner appearance requires a separate operand-layout design. One candidate
for review is discrete cubic growth that continues around an edge, with an explicit
rule assigning each generated surface to a core face. This is a design candidate only:
it requires revisiting the source-face footprint restriction and is not authorized by
this feedback. The rejected continuous bridge/bevel/frame remains excluded. No geometry,
accepted baseline, or production behavior changed as a result of that initial review.
The owner subsequently authorized the proposed [edge/corner prototype](sr10-corner-growth-design.md),
which remains isolated and now has [owner visual approval](sr10-corner-growth-design.md#owner-review).

### Reproduce and review

```sh
npm run build
node scripts/review-sr10-boolean.mjs
node scripts/serve-demo.mjs 5174 artifacts/sr10-boolean/bundle
```

Open `http://localhost:5174/`. Its comparison table links the accepted field, union,
and idealized core for all three scenes. Use `--build-only` on the review command to
skip automated capture. The local `manifest.json` records camera, effective material,
platform, generation measurements, image hashes and pixel differences. The accepted
baseline command and its output directory are not used or overwritten.

Owner review should assess terrace readability through transmission, the physical
corner seam during rotation, any apparent silhouette change, and the opaque control.
Approval of a visual direction would still leave these integration gates:

* Reduce and measure generation/validation cost, triangle count and peak allocation;
  establish a supported seed/numerical envelope and a broader Float32 test matrix.
* Design rejection before resource replacement. The current viewer clears the old
  mesh before calling its accepted generator; directly installing this rejecting
  prototype would therefore violate the intended transactional failure behavior.
  The test-only substitution exercises successful results, not rejection recovery.
* Decide the user-visible diagnostic/fallback behavior for non-cube habits and rejected
  operands without changing scientific state or default picking/export.
* Review any change to the accepted preset and pinned baseline explicitly. Edge-spanning
  operands, reviewed surface-profile mappings, and literal etching remain separate,
  unresolved scope decisions.

Verification: `npm run check` passes with **521 tests in 39 files** (ten additional
spike tests); `node scripts/check-docs.mjs` and `git diff --check` pass. Owner visual
review and production integration are **not accepted** by these automated checks.

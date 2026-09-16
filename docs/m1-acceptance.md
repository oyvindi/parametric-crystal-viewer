# M1 Geometry Prototype Acceptance

M1 is complete. This audit covers the [bootstrap gate, delivery list, and
acceptance criteria](plan.md#m1--geometry-prototype). The V1 checklist and later
milestones remain unchanged. No owner access or scientific artifact is pending.

## Bootstrap evidence

On 2026-09-16, an isolated source copy at `/tmp/crystal-m1-clean`, excluding
`.git`, `node_modules`, and `dist`, installed from the committed lockfile using
`npm ci --offline`. Installation added 52 packages and reported no vulnerabilities.
All five initial packages built and the Node test projects passed. The final
repository check passes 56 tests across core and renderer triangulation.

The environment uses Node 26.8.1, npm 11.19.0, native ESM, ES2022, TypeScript
project references and Vitest Node projects. Commands and the local launcher
workaround are recorded in [architecture](architecture.md#repository-tooling).
[check-workspace.mjs](../scripts/check-workspace.mjs) enforces package manifests
and static package imports against the allowed graph. Core has no runtime
package dependencies or browser/rendering imports; its tests explicitly check
that `window` and `document` are absent. Build outputs and caches are ignored.

## Delivery and acceptance evidence

| Requirement | Implemented evidence |
|---|---|
| Generic input and diagnostics | [crystal.ts](../packages/crystal-core/src/crystal.ts), [morphology.ts](../packages/crystal-core/src/morphology.ts), and the finite [diagnostic code list](../packages/crystal-core/README.md#m1-diagnostic-codes). Independent input failures are collected before geometry; redundant forms demonstrate successful results with warnings. |
| Direct and reciprocal lattice | [Lattice implementation](../packages/crystal-core/src/lattice.ts); cubic, orthorhombic, monoclinic, triclinic, metric dot products, independent cell-volume formula, reciprocal identity, impossible/degenerate cells, and Å/nanometre equivalence. |
| Miller and symmetry | [Miller implementation](../packages/crystal-core/src/miller.ts), [symmetry](../packages/crystal-core/src/symmetry.ts), and [directions](../packages/crystal-core/src/planes.ts). Tagged indices, integer reduction, opposite orientation, non-orthogonal inverse transpose, explicit identity, conflicting/missing descriptions, group identity/inverses/closure, relative metric validation, and periodic affine translations are tested. |
| Cubic registry | Pinned source, license, reproducible subset and integrity metadata in the [acquisition record](sources/m1-acquisition.md#acquired-and-verified-m1-artifacts). Tests compare explicit and registry operations and geometry. Shared registry objects are immutable. |
| Direct intersection and polygons | [geometry.ts](../packages/crystal-core/src/geometry.ts): explicit recession test, triple enumeration, deterministic vertices, outward polygon loops, collinear cleanup, edge incidence, Euler closure, signed volume and finite checks. |
| Invalid geometry | No active forms, open prism, open box with four finite vertices, capped prism, zero-volume intersection, insufficient relative volume, near-rank uncertainty, arithmetic overflow and output-placement failure are covered separately. No invalid result exposes a mesh. |
| Overlapping constraints | Exact minimum support, tolerance ties without chaining, looser parallel and oblique redundancy, all operations grouped by form, reordered forms/planes, ties changing to one contributor without changed vertices, and opposite normals. |
| Scale and precision | Float64 output, cell-center placement, scale/units equivalence, non-finite input rejection, finite reciprocal support, and independently exercised matrix/normal/plane/vertex/collinearity/volume policies. See [numerical envelope](scientific-model.md#implemented-m1-numerical-envelope). |
| Renderer triangle mapping | [triangulateCrystal](../packages/crystal-three/src/index.ts) lives in the rendering package, produces deterministic triangle indices and a core face index per triangle, and is tested for winding and tied contributor recovery. Actual Three.js buffers and viewer picking remain viewer integration work. |

The automated evidence is in [original core tests](../packages/crystal-core/src/index.test.ts),
[acceptance tests](../packages/crystal-core/src/acceptance.test.ts),
[registry integrity tests](../packages/crystal-core/src/registry.test.ts), and
[renderer mapping tests](../packages/crystal-three/src/index.test.ts).

M1 validates the mathematical part of Miller–Bravais notation; setting-aware
expansion remains explicitly assigned to M3. Atomic site expansion remains M6;
M1 validates affine operations and demonstrates translation of fractional
positions without affecting morphology directions. Viewer stale-mesh recovery,
picking, highlighting and full interaction latency remain the explicitly
scheduled viewer-integration checks. These are not claimed as implemented.

## Benchmark evidence

Command: `npm run benchmark:m1` after build. Script:
[benchmark-m1.mjs](../scripts/benchmark-m1.mjs). Measurements on 2026-09-16 used
Node 26.8.1, Linux x64, AMD Ryzen 7 3800X, three warmups and nine measured samples
per case. Values are wall-clock times; no timing assertions are imposed on CI.

| Case | Median ms | Maximum ms | Vertices | Faces |
|---|---:|---:|---:|---:|
| Public cube pipeline, 6 planes | 13.585 | 14.018 | 8 | 6 |
| Public cube + octahedron, 14 planes | 13.645 | 13.667 | 24 | 14 |
| Public three-form cubic pipeline, 26 planes | 14.189 | 15.118 | 48 | 26 |
| Direct intersection, 26 planes | 1.555 | 2.094 | 48 | 26 |
| Direct intersection, 98 planes | 30.330 | 47.433 | 192 | 98 |
| Deliberate stress intersection, 290 planes | 1229.903 | 1817.451 | 576 | 290 |

Public cases include lattice and symmetry validation plus complete geometry
and metadata generation. Direct cases enumerate primitive integer triples in
`[-r, r]^3`, normalize them, and assign unit support; radii 1, 2 and 3 produce
26, 98 and 290 distinct planes. They exercise real faces rather than adding
hundreds of immediately discarded duplicate constraints.

The ordinary cases meet the 50 ms M1 core engineering target. The 290-plane
stress case does not support interactive synchronous regeneration. The
[performance decision](decisions/0003-m1-intersection-performance.md) evaluates
that failure, retains direct enumeration for the measured prototype workload,
and requires reevaluation if actual V1 habits exceed the budget. This limitation
is not hidden by an artificial size cap or by calling the stress case interactive.

## Reproduction

Run the npm launcher documented in architecture if plain `npm` is unavailable:

```sh
npm ci
npm run check
npm run benchmark:m1
node scripts/check-docs.mjs
node scripts/generate-m1-registry.mjs /path/to/spg_database.c --check
```

The generator's upstream input is acquired under the pinned terms and hash in
the acquisition record; routine build/tests do not require network access or
that full database file. Final documentation checks cover local files, heading
anchors, code fences, scope ownership and milestone assignments.

# Direct Half-Space Intersection and Polygon Output

**Status:** accepted.

## Context

V1 must generate bounded convex crystal geometry from relatively small crystallographic plane sets, detect unbounded and degenerate inputs, preserve overlapping-form provenance, and remain independent of Three.js. Artificial seed bounds can misclassify distant valid planes, while general CSG adds unnecessary scope.

## Decision

After equivalent-direction and overlapping-constraint reduction, use double-precision triple-plane enumeration with an explicit positive-spanning boundedness test. Retain intersections that satisfy every half-space, merge coincident vertices, and reconstruct one ordered convex polygon loop per surviving plane.

Core output preserves polygon loops. The Three.js adapter triangulates them deterministically and retains the originating core face index for each rendered triangle. The full algorithm and topology contract is defined in the [scientific model](../scientific-model.md#intersection-algorithm).

## Alternatives

* Use a maintained half-space or convex-polytope library. This remains a fallback if a compatible library provides double-precision behavior, explicit unboundedness handling, deterministic topology, suitable licensing, and renderer independence.
* Construct the polytope through dual convex hulls. This may scale better but complicates implementation and contributor reconstruction.
* Clip an oversized seed box. This introduces artificial scale choices and risks incorrect boundedness results.
* Use general CSG. This is broader than the convex half-space problem and makes numerical behavior harder to audit.

## Consequences

The implementation is small, inspectable, and aligned with face provenance. Its straightforward form has higher asymptotic cost than specialized hull algorithms, so M1 must benchmark representative and deliberately large V1 plane sets. A replacement must preserve the same scientific output and diagnostics and requires a superseding decision record.

## References

* [Half-Space Intersection](../scientific-model.md#half-space-intersection)
* [Intersection Algorithm](../scientific-model.md#intersection-algorithm)
* [M1 — Geometry Prototype](../plan.md#m1--geometry-prototype)

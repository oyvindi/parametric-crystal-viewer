# M1 Intersection Performance Envelope

**Status:** accepted. Supersedes the unmeasured performance assumption in
[0002](0002-direct-half-space-intersection.md); retains its algorithm and output contract.

## Evidence and decision

The [M1 benchmark](../m1-acceptance.md#benchmark-evidence) measures the complete
public pipeline at about 14 ms for 6–26 planes on the recorded desktop. A
50 ms core regeneration budget is the M1 engineering target for these ordinary
form combinations, leaving viewer integration to measure full interaction
latency on target hardware. This is an implementation performance target, not a
new product capability or a guarantee for every machine.

The deliberately large 290-plane set takes about 1.2 seconds and is unsuitable
for synchronous interactive editing. Evaluating that failure is part of M1;
it must not be represented as interactive performance.

Retain direct enumeration for the prototype. Integer-matrix lookup for closure
and short-circuit recession/half-space checks reduce avoidable work without
changing the scientific algorithm. No artificial plane cap or bounding box is
introduced. Large inputs remain computable with the same diagnostics.

## Alternatives evaluated

* A dual convex hull would reduce candidate enumeration for large plane sets.
  It needs a robust hull implementation and careful handling of dual distances,
  coplanarity, and mapping back to all contributors. Its principal benefit is
  the stress case; the measured prototype combinations already meet the target.
* A geometry dependency could provide that hull implementation, but would need
  separate licensing, double-precision, degeneracy, determinism, and provenance
  evaluation. M1 does not select or acquire one without a demonstrated need in
  actual delivered form combinations.
* Direct enumeration remains easy to audit and preserves the existing tested
  contract. Its worst-case enumeration remains quartic when each triple must be
  checked against every plane. Local optimization does not remove that limit.

## Consequences and revisit trigger

M2 must measure its selected habits and full viewer interaction. If delivered
V1 form combinations exceed the core budget or require stress-sized plane sets,
replace the algorithm behind the same core contract through a superseding
record before accepting dependent interactive behavior. Worker scheduling alone
would improve responsiveness but would not solve regeneration latency.

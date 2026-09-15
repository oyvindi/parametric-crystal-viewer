# Scientific Core Dependency Boundary

**Status:** accepted.

## Context

Scientific calculations consume structural and morphology inputs, while CIF normalization needs scientific validation. Leaving their dependency direction unspecified risks circular imports between core and data packages.

## Decision

Adopt the dependency graph and ownership defined in [architecture](../architecture.md#package-dependencies-and-ownership). Shared scientific types and calculations belong in core; the data package depends on core to normalize and validate imported definitions.

## Alternatives

* Make core depend on mineral schemas in the data package. This couples scientific calculations to catalog concerns and risks a cycle when import processing needs those calculations.
* Introduce a separate shared-types package. This adds a package boundary before a need for independently owned contracts has been established.

## Consequences

Core can run independently of the catalog, browser, and renderer. Data processing and rendering use the same scientific contracts. The viewer coordinates these packages, and data adapters translate catalog and import representations into core inputs.

M1 verifies that core builds and runs without browser or rendering dependencies. Atomic expansion and import integration remain scheduled for M6; assigning ownership does not bring their delivery forward.

## References

* [Package dependencies and ownership](../architecture.md#package-dependencies-and-ownership)
* [M1 — Geometry Prototype](../plan.md#m1--geometry-prototype)
* [M6 — CIF / Structural Data](../plan.md#m6--cif--structural-data)

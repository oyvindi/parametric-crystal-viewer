# Technical Decision Records

[Documentation map](../spec.md#document-map)

Use a short decision record when a significant technical choice needs durable rationale, such as a geometry algorithm, dependency, or package boundary. Routine implementation details belong in tasks or code. Platform choices and current technical constraints belong in [architecture](../architecture.md).

Name records `NNNN-short-title.md`. Include:

* **Status:** proposed, accepted, or superseded.
* **Context:** the concrete problem and constraints.
* **Decision:** the selected approach.
* **Alternatives:** the meaningful options considered.
* **Consequences:** tradeoffs and validation needs.
* **References:** links to the affected authoritative contracts and any superseding record.

Decision records explain why a choice was made. Update the owning contract when an accepted decision changes required behavior; do not create a second competing specification here. Do not invent historical rationale for existing choices.

* [0001 — Scientific Core Dependency Boundary](0001-scientific-core-dependency-boundary.md) — accepted.
* [0002 — Direct Half-Space Intersection and Polygon Output](0002-direct-half-space-intersection.md) — accepted.

* [M1 Intersection Performance Envelope](0003-m1-intersection-performance.md)

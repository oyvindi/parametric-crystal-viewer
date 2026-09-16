# Repository Guidance

## Documentation ownership

Start with [docs/spec.md](docs/spec.md), the documentation entry point and authority for V1 scope. Read the owning contracts before changing behavior:

| Document | Owns |
|---|---|
| [spec.md](docs/spec.md) | Product scope, capabilities, non-goals, and reference application |
| [scientific-model.md](docs/scientific-model.md) | Coordinate conventions, symmetry, geometry, physical models, and validation |
| [data-model.md](docs/data-model.md) | Mineral records, habits, atomic expansion, periodic bonds, imports, and provenance |
| [architecture.md](docs/architecture.md) | Platform choices, package boundaries, rendering integration, and testing policy |
| [viewer-api.md](docs/viewer-api.md) | Web Component, controls, lifecycle, events, inspection, and serialization |
| [plan.md](docs/plan.md) | Delivery order, milestone dependencies, and acceptance criteria |
| [decisions/](docs/decisions/README.md) | Significant technical decisions and rationale |

## Maintaining the documents

* Give each requirement one authoritative home. Link to it from other documents instead of copying its definition.
* Keep the V1 checklist in `docs/spec.md`; the plan must reference it rather than define a competing release scope.
* Keep platform and cross-package implementation choices in architecture. Use decision records for substantial choices with alternatives and tradeoffs; use tasks or code for temporary implementation details.
* Preserve approved scientific and runtime contracts when reorganizing documentation. Do not silently resolve open questions or expand scope during editorial work.
* Mark unresolved decisions as blocking or deferred, identifying the affected milestone when known. Do not turn illustrative types into final API commitments without a design decision.
* Once code exists, keep exact types and signatures in code and generated API documentation; prose explains required behavior and constraints.
* Use relative Markdown links and heading anchors rather than numbered section references. Update inbound links whenever headings or files move.
* After documentation changes, check local file/anchor links, Markdown structure, and consistency between the scope, owning contracts, and milestone acceptance criteria.

## Implementation boundaries

Follow [architecture](docs/architecture.md): keep crystallographic calculations and generated geometry independent of Three.js and browser APIs. Keep mineral data, scientific geometry, rendering, and application controls separate. The viewer is framework-agnostic; framework-specific wrappers are left to consumers.

## Working-tree hygiene

Keep generated, machine-local, and secret-bearing artifacts out of version control. Before adding a tool, build output, cache, local environment file, or generated artifact, update `.gitignore` when it should not be committed. Do not ignore source data, scientific fixtures, or reproducible generated registry artifacts that the project contract requires to be version-controlled. Check `git status` before staging so ignored artifacts are not added with force.

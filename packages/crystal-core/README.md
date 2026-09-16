# `@crystal/core`

Renderer-neutral crystallographic calculations and generated geometry.

## M1 diagnostic codes

| Code | Meaning |
|---|---|
| `core.input.invalid-unit-cell` | Cell dimensions or angles are invalid or degenerate. |
| `core.input.invalid-miller-indices` | Indices are non-integral, zero, incompatible, or cannot be transformed. |
| `core.input.invalid-development` | Form development is non-finite or outside `[0, 1]`. |
| `core.input.invalid-morphology-scale` | Morphology scale is non-finite or non-positive. |
| `core.input.invalid-half-space` | A half-space normal or distance is invalid. |
| `core.symmetry.*` | Symmetry description, group laws, metric compatibility, or lookup failed. |
| `core.geometry.no-active-forms` | No form has positive development. |
| `core.geometry.unbounded` | Constraints do not enclose a usable volume. |

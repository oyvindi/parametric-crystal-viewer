# Orthographic Camera Projection

**Status:** accepted.

## Context

The [renderer capability list](../architecture.md) requires both perspective and orthographic cameras, but the viewer shipped with only a `PerspectiveCamera`. Scientific illustration and inspection often need an orthographic view to compare face angles and habit proportions without perspective distortion.

State serialization (decision [0004](0004-viewer-state-serialization.md)) pinned `version: 1` as the only supported format and rejected any migration in V1. Adding a projection field that V1 states did not carry forces the first state-version bump and the first migration path, which 0004 explicitly deferred to "when a second state version is needed."

## Decision

**Projection support.** New viewers default to `"perspective"` and keep a `PerspectiveCamera` plus an `OrthographicCamera`. `setProjection("perspective" | "orthographic")` switches the active camera; `getProjection()` reads it. Toggling synchronizes the inactive camera's position, orientation, zoom, and clipping from the active one so switching back preserves the view. All rendering, raycasting, resizing, framing (`resetCamera`/`fitCamera`), background-panorama FOV derivation, and serialization use the active camera. Legacy version-1 state also restores as perspective.

**Framing.** `frameOrtho(halfHeight)` sets the orthographic frustum's unzoomed half-height directly. Initial framing (`resetCamera`/`fitCamera`) derives its target-plane half-height from the current perspective-camera distance and FOV, then applies the current aspect. This gives both projections the same initial apparent model scale. On resize, the orthographic frustum height is preserved and only the width tracks the new aspect.

**State version 2.** `STATE_VERSION` is `2`. `CameraState.projection` is `"perspective" | "orthographic"`; legacy V1 states omit it and default to `"perspective"`. `CameraState.frustumHeight` is the unzoomed world-space frustum height (top − bottom at zoom 1), the orthographic analog of the perspective camera's fixed FOV. It is serialized only for the orthographic projection and omitted by perspective and legacy V1 states. `getState` records the active projection, `frustumHeight`, and the active camera's zoom/near/far, so an orthographic state restores its exact framing independent of the target viewer's geometry. Restore sizes the frustum directly from `frustumHeight` when present, falling back to the restored perspective framing for legacy states that lack the field.

**Migration.** Version 1 is accepted on restore and migrated: the projection defaults to `"perspective"` (the only projection V1 supported) and the version is normalized to 2 internally. No other V1 field changes. `validateStateShape` rejects versions other than 1 and 2 with `viewer.state.unsupported-version`.

## Alternatives

* *Add projection without a version bump (treat as additive optional field).* Rejected: 0004 committed to a single supported version and no silent field addition; a new persisted field that changes restoration framing must be versioned so hosts can detect the format they hold.
* *Orthographic-only framing derived from perspective FOV on the fly.* Rejected: deriving an equivalent frustum each frame couples the two cameras' state and breaks independent zoom/clip control; keeping a real `OrthographicCamera` with its own frustum is simpler and matches Three.js conventions.
* *Reset the view on projection switch instead of synchronizing.* Rejected: preserving the user's viewpoint across the toggle is the expected behavior and costs little; `syncInactiveCamera` copies pose and clipping before the switch.

## Consequences and revisit triggers

* `getState`/`setState` round-trips preserve projection and orthographic framing for version 2; version 1 states migrate transparently.
* Hosts that persisted version 1 states restore unchanged (projection defaults to perspective); hosts may re-save as version 2.
* The background panorama derives an equivalent perspective FOV from the orthographic frustum height and target distance, so panorama composition matches the scientific content in either projection.
* Revisit if a third projection or a per-projection framing divergence makes the single `frameOrtho` model insufficient.

## References

* [Viewer API — Camera and Preferred Views](../viewer-api.md#camera-and-preferred-views)
* [Viewer API — Persistent State Coverage](../viewer-api.md#persistent-state-coverage)
* [Viewer API — Data Portability and Versions](../viewer-api.md#data-portability-and-versions)
* [Architecture — renderer capabilities](../architecture.md)
* Supersedes the versioning stance in [0004 — Viewer State Serialization](0004-viewer-state-serialization.md) (no migration, single supported version).

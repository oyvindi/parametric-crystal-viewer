# 0010 — SR7 Surface State Finalization and Reduced-Motion Handling

* **Status:** accepted.
* **Context:** The [surface rendering plan](../surface-rendering-plan.md) SR7 step requires a
  public-API and acceptance audit for the surface-rendering track. Two decisions needed
  durable rationale before the track could close:

  1. *Serialized state migration.* SR7 says to define a state migration before changing the
     serialized schema, and to bump `STATE_VERSION` if serialized surface fields are added or
     renamed. The surface fields already in version-1 state are `surfaceDetail { enabled,
     strength }`, added in SR4. Effective surface profile information is derived from the
     selected mineral and current generated faces and is deliberately not serialized
     ([viewer API](../viewer-api.md#generic-surface-detail)).
  2. *Accessibility behavior for motion and high-frequency effects.* The plan asks for
     `prefers-reduced-motion` handling for striations. The surface detail (striations and
     microvariation) is a static procedural pattern; the only continuous motion the viewer
     produces is the optional `start()` auto-rotation. Crystallographic calculation and
     generated geometry must remain independent of Three.js and browser APIs
     ([architecture](../architecture.md#architectural-principles)).

* **Decision:**
  1. **No state migration is needed.** The version-1 `surfaceDetail` member is already the
     complete serialized surface state: the only stable controls are enable/disable and
     overall strength, both already serialized. Effective profile information is derived, not
     persistent. `STATE_VERSION` remains `1`; no migration is introduced. Legacy version-1
     states written before SR4 omit `surfaceDetail` and restore with detail off, as already
     documented and tested.
  2. **Honor `prefers-reduced-motion: reduce` in `crystal-viewer`.** When the user setting is
     active, `start()` suppresses the continuous rotation increment, so the high-frequency
     surface detail does not sweep across the screen. The animation loop still runs (the host
     requested it), preserving the running/`animationHandle` contract, but advances no motion.
     The static surface detail itself remains visible: it is reviewed typical information,
     not motion, and on-demand interaction continues to render through `renderOnce`. The
     detection reads `matchMedia("(prefers-reduced-motion: reduce)")` once and caches the
     `MediaQueryList`; it is safe outside a browser (returns inactive). The handling lives in
     `crystal-viewer` (the browser-facing layer), so `crystal-three` surface code stays free
     of browser APIs.

* **Alternatives:**
  * *Bump to state version 2 to re-serialize surface state* — no field is being added, renamed,
    or removed; a version bump and migration would impose a compatibility break for no schema
    change.
  * *Serialize effective profile ids* — rejected at SR5; profiles are derived from the
    selected mineral and current faces and would duplicate data already referenced by the
    mineral identity. Keeping them derived avoids a stale-serialization hazard.
  * *Disable or dampen surface detail under reduced-motion* — rejected. The surface detail is
    static, reviewed typical information; suppressing it would hide scientific detail rather
    than reduce motion. The accessibility goal is met by stopping the rotation that moves the
    patterns, not by removing the patterns.
  * *No-op `start()` entirely under reduced-motion* — would break hosts that rely on the
    running loop for their own rendering cadence. Keeping the loop without rotation preserves
    the contract.
* **Consequences:** Existing version-1 states round-trip unchanged; no migration code or
  compatibility window is introduced. The auto-rotation demo path stops spinning when the OS
  requests reduced motion, while the surface detail and all scientific geometry remain
  unchanged. Hosts that introduce their own animation remain responsible for honoring the
  preference for that motion. Numeric tests verify the rotation suppression and the
  no-migration round-trip.
* **References:** [SR7 plan](../surface-rendering-plan.md#sr7--public-api-demo-and-acceptance-audit),
  [Generic Surface Detail](../viewer-api.md#generic-surface-detail),
  [Reduced-Motion and High-Frequency Effects](../viewer-api.md#reduced-motion-and-high-frequency-effects),
  [Viewer State Serialization](0004-viewer-state-serialization.md),
  [ADR 0007](0007-generic-surface-microvariation.md), and
  [ADR 0008](0008-reviewed-surface-profiles.md).

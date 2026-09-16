# M7 Viewer API Acceptance

M7 is complete. This audit covers the [M7 criteria](plan.md#m7--viewer-api) and the
[Web Component](viewer-api.md#web-component), [loading](viewer-api.md#mineral-loading),
[connection/disposal](viewer-api.md#connection-and-disposal), [invalid geometry](viewer-api.md#invalid-geometry-and-recovery),
and [state serialization](viewer-api.md#state-serialization) contracts. The success
criterion is met: the public API is stabilized, documented, and exercised by the
required acceptance tests.

## Delivery

| Capability | Evidence |
|---|---|
| Stabilized public API | [`CrystalViewer`](../packages/crystal-viewer/src/index.ts) — async transactional `loadMineral`, `setHabit`/`setVariant`/`setFormDevelopment`/`setFormEnabled`/`setMorphologyScale`, `selectFace`/`highlightEquivalentFaces`, `setShowAxes`/`setShowUnitCell`/`setShowBonds`/`setShowWireframe`, `setViewMode`/`setLatticeRepetition`, `resetCamera`, `resize`/`render`/`start`/`stop`, `disconnect`/`reconnect`/`dispose`, `getGeometryStatus`, and `getState`/`setState`. |
| State serialization | [`state.ts`](../packages/crystal-viewer/src/state.ts) defines the versioned `ViewerState` (version 1) and `validateStateShape`. `getState`/`setState` are transactional; round-trip preserves equivalent persistent configuration. |
| Web Component | [`component.ts`](../packages/crystal-viewer/src/component.ts) exports `CrystalViewerElement` and `defineCrystalViewerElement()` (the `<crystal-viewer>` custom element), exported via the `@crystal/viewer/component` subpath. |
| Loading contracts | Overlapping loads commit only the newest (`load-superseded`); failed loads preserve configuration (`mineral-load-failed`); committing a different mineral clears the previous mesh. |
| Lifecycle | `disconnect` pauses rendering and detaches listeners; `reconnect` resumes the previous mode; disposal is idempotent and permanent. |
| Events | `mineral-loaded`, `mineral-load-failed`, `load-superseded`, `habit-changed`, `variant-changed`, `form-changed`, `geometry-changed`, `geometry-invalid`, `view-mode-changed`, `lattice-repetition-changed`, `face-selected`, `structure-loaded`/`-failed`, `state-restored`/`-rejected`, `viewer-ready`. |
| Demos | [basic-embedding](../packages/crystal-demo/basic-embedding.html) (two independent instances, plain HTML), [controls](../packages/crystal-demo/controls.html) (programmatic controls, events, state save/restore), plus updated [fluorite](../packages/crystal-demo/fluorite.html), [quartz](../packages/crystal-demo/quartz.html), [minerals](../packages/crystal-demo/minerals.html), and [structure](../packages/crystal-demo/structure.html) demos. |

Package boundaries are respected: `crystal-viewer` owns loading, orchestration,
lifecycle, and state serialization; the Web Component is a browser-only subpath
export so the Node-safe main entry remains importable without DOM globals. No
package gained a disallowed dependency. `happy-dom` was added as a root
development dependency for the Web Component integration tests.

## Resolved decisions

The versioning, data-compatibility, and face-selection decisions identified in
the owning contract are resolved in [0004 — Viewer State Serialization](decisions/0004-viewer-state-serialization.md):
state-format version 1 (no migrations in V1), bundled minerals referenced by id
and data revision (mismatch rejects with `viewer.state.incompatible-data`),
imported structures embedded in full (portable, provenance preserved), and face
selection excluded as transient. The owning contract
([viewer-api.md](viewer-api.md#state-serialization)) is updated to point to the
decision and the implementation.

## Acceptance tests

`npm test` runs 276 tests across 18 files. The M7 tests are:

* [Viewer API and loading/lifecycle/state tests](../packages/crystal-viewer/src/m7-acceptance.test.ts) (15 + 1 todo):
  overlapping loads commit only the newest and emit `load-superseded`; a superseded
  load does not commit even when the newest fails and state is preserved;
  committing a different mineral clears the previous mesh and an invalid new
  definition shows no mesh; disconnect pauses rendering and detaches listeners
  and reconnect reattaches without duplicates; a running viewer resumes on
  reconnect while a stopped viewer stays stopped; disposal is idempotent, later
  mutating calls report disposal, and reconnect does not reactivate a disposed
  viewer; `getState → setState → getState` preserves equivalent persistent
  configuration (same and fresh viewer); saved effective settings take precedence
  over preset defaults; camera, display, atomic view mode, and lattice repetition
  restore; an imported structure restores in a fresh viewer without the original
  import session and preserves provenance; malformed state, unsupported versions,
  and incompatible references reject without partial mutation; structurally valid
  state that produces invalid geometry is accepted with fresh (no mesh) and
  retained-mesh behavior and subsequent recovery; each paired trigonal-setting
  representation restores with its declared setting; and events fire for
  programmatic changes and state restoration.
* [Web Component tests](../packages/crystal-viewer/src/m7-component.test.ts) (5, happy-dom):
  plain-HTML embedding loads a mineral from the `mineral` attribute and creates a
  canvas child; the mineral attribute change reloads; two instances keep
  configuration and lifecycle independent; disconnect preserves configuration and
  reconnect restores it and does not reactivate a disposed component; and a
  `viewer-ready` event fires on connection.
* The M8 appearance-state round-trip is left as a `it.todo` placeholder; appearance
  coverage is defined in the serialization contract but verification is deferred
  to M8, which delivers appearance support.

## Limitations and notes

* `loadMineral` is async: it resolves and validates the definition synchronously,
  then yields once before committing so overlapping requests interleave and only
  the newest commits. Bundled-catalog resolution remains synchronous; a future
  async data source would compose with the same generation guard.
* `setState` is synchronous (bundled data and structure re-expansion are
  synchronous); it supersedes pending loads via the same generation counter.
* `scripts/check-workspace.mjs` still fails under Node 26 on the pre-existing
  `node:fs` external-import assertion (M5 fixture reader), unrelated to M7. The
  TypeScript build, all tests, and the documentation check pass.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
```

Verification passed: 276 tests across 18 test files (275 passed, 1 todo), the
TypeScript workspace build, and documentation links/anchors/code fences.

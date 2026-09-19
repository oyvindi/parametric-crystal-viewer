# Viewer State Serialization

**Status:** accepted (versioning and migration stance superseded by [0012 — Orthographic Camera Projection](0012-orthographic-projection.md); referenced-data compatibility and face-selection decisions remain in force).

## Context

The [state serialization contract](../viewer-api.md#state-serialization) deferred three decisions to M7:

1. State-format version identifiers, supported versions, migration policy, and the mechanism for establishing referenced-data compatibility.
2. Whether face selection is persistent.
3. (Appearance-state coverage is defined in M7 but its round-trip verification is deferred to M8; see the M7 acceptance audit.)

M7 stabilizes the public viewer API and ships `getState`/`setState`. These decisions must be resolved for the round-trip and transactional-restoration guarantees to hold.

## Decision

**Versioning.** Every complete state payload declares an integer `version`. V1 ships `version: 1`. `setState` rejects unsupported versions with `viewer.state.unsupported-version` rather than guessing. No migration path is provided in V1: a future version that changes the persistent shape will require an explicit migration decision record and must preserve the round-trip guarantee. Version 1 is the only supported version.

**Referenced-data compatibility.** Bundled minerals are referenced by identity and data revision (`mineral.id` + `mineral.dataRevision`). On restore, the viewer resolves the bundled record and verifies its `dataRevision` matches the saved value; a mismatch rejects with `viewer.state.incompatible-data` and leaves the previous state unchanged. This prevents silent substitution when a bundled record has been revised since the state was saved. Imported structural definitions are embedded in full (`structure.definition`), including cell, symmetry, sites, applicable bonds, references, provenance, and source metadata, so restoration does not depend on the original import session; the viewer re-validates and re-expands the embedded definition before committing. Custom definitions needed to reproduce a configuration must be included in the payload or resolve through compatible bundled data.

**Face selection.** Face selection is not persistent. It is transient state, like pointer hover and animation-loop handles: a selected face is identified by its rendered-mesh face index, which is not stable across geometry regeneration (forms, habit, or mineral changes can remove or reorder faces). Serializing it would require a stable cross-regeneration identity that the current geometry provenance does not provide at no cost, and the contract explicitly leaves this open. Selection is therefore excluded from `ViewerState`. Hosts that need to re-select after restoration can re-apply a selection through the public `selectFace`/`highlightEquivalentFaces` API once geometry is regenerated.

## Alternatives

* *Migrations with converters.* Considered and rejected for V1: there is only one version, so there is nothing to migrate from, and a migration framework now would be speculative.
* *Compatibility by identity alone (ignore dataRevision).* Rejected: a revised bundled record could change habit defaults or form sets, silently changing the restored configuration and breaking the round-trip guarantee.
* *Persistent face selection keyed by contributor/plane identity.* Rejected for V1: face identity is mesh-relative, contributor sets change across edits, and a stable key would add complexity without a clear V1 need. Reassess if a later milestone requires persistent selection.

## Consequences and revisit triggers

* `getState`/`setState` round-trips preserve equivalent persistent configuration for version 1, excluding the retained mesh (outside the round-trip guarantee by contract).
* A bundled-data revision change between save and restore is a hard rejection, not a silent reframe; hosts should re-save state after upgrading data.
* Revisit the versioning decision when a second state version is needed; revisit face-selection persistence if a milestone requires stable cross-regeneration face identity.

## References

* [Viewer API — State Serialization](../viewer-api.md#state-serialization)
* [Viewer API — Persistent State Coverage](../viewer-api.md#persistent-state-coverage)
* [M7 acceptance audit](../m7-acceptance.md)

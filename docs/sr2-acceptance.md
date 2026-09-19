# SR2 Categorical Luster Acceptance

SR2 is complete. Mineral appearance records can carry a small, validated luster
classification, while `crystal-three` owns the corresponding renderer parameters.
Scientific geometry, picking, and serialized viewer state remain unchanged.

## Decisions

The accepted design is recorded in
[ADR 0005](decisions/0005-categorical-luster-pearly-sheen.md):

* the initial vocabulary is `vitreous`, `pearly`, `metallic`, and `dull`;
* absent or unknown renderer input falls back to `vitreous`;
* pearly rendering uses Three.js physical-material sheen;
* explicit numeric appearance fields remain authoritative;
* luster is resolved through the selected preset rather than serialized separately;
* renderer profile constants are curated visualization choices, not measurements.

## Data and provenance

Quartz, fluorite, albite, beryl, and forsterite presets carry sourced `vitreous`
classifications. Pyrite presets carry sourced `metallic` classifications. Each is
covered by a `reported` provenance entry with a stable Handbook reference; numeric
appearance parameters retain their separate `curated` provenance.

The catalog deliberately assigns no pearly preset yet. Reviewed calcite and gypsum
evidence is specific to basal or cleavage surfaces, and applying pearly sheen to an
entire generated growth morphology would violate that scope. Pearly profile behavior
is tested with a clearly identified non-catalog fixture until SR5 supplies face-local
selection.

Mineral JSON remains authoritative. `records.ts` was regenerated, and the workspace
check now fails if the generated registry diverges from its JSON sources.

## Renderer and viewer behavior

`LUSTER_PROFILES` centralizes the category mapping. Pearly has a curated warm sheen;
the other categories explicitly map sheen to zero and continue to use their existing
roughness, metalness, transmission, IOR, and absorption fields. Presets without luster
therefore retain their pre-SR2 rendering.

`getAppearances` reports a preset's optional classification. `getAppearance` reports
the effective category plus derived sheen values. Luster is intentionally excluded
from `setAppearanceField` and appearance overrides, so existing serialized states
remain compatible and a selected preset is sufficient to restore it.

## Visual and automated verification

The fixed [SR1 scenes](baselines/sr1/manifest.json) are the comparison set; the
[SR2 scenes](baselines/sr2/manifest.json) use the same nine minerals and presentation.
Because all currently eligible catalog categories map to the existing numeric material
paths, silhouettes and face readability remain stable. Pearly sheen correctness is
verified numerically on a `MeshPhysicalMaterial` rather than by applying unsupported
whole-crystal evidence.

```sh
npm run check
node scripts/check-docs.mjs
npm run baseline:sr2
git diff --check
```

Acceptance requires synchronized generated records, valid sourced classifications,
centralized category mapping tests, state round trips, nine SR2 captures, and all
workspace and documentation checks passing.

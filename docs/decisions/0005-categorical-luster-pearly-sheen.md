# 0005 — Categorical Luster and Pearly Sheen

* **Status:** accepted.
* **Context:** The [surface rendering plan](../surface-rendering-plan.md) SR2 step requires a
  controlled luster vocabulary in mineral appearance data, with category-to-renderer
  mappings centralized in `crystal-three`. Three.js r186 `MeshPhysicalMaterial` provides
  several candidate features for pearly surfaces: `sheen`/`sheenColor`/`sheenRoughness`,
  `clearcoat`, `iridescence`, and custom shader contributions. The choice must be durable,
  preserve scientific geometry, and keep every renderer constant identifiable as curated
  rather than measured.
* **Decision:** Use a four-category vocabulary — `vitreous`, `pearly`, `metallic`, `dull`
  — with `vitreous` as the fallback when `luster` is absent. Pearly rendering uses the
  `MeshPhysicalMaterial` sheen layer (`sheen > 0`, a warm `sheenColor`, moderate
  `sheenRoughness`); all other categories keep `sheen` at zero and rely on the existing V1
  PBR fields. The luster classification is owned by `crystal-data` (part of the mineral
  appearance record); the numeric sheen mapping is centralized in `crystal-three`
  (`LUSTER_PROFILES`). Explicit numeric preset fields always take precedence over the
  category profile. `luster` is resolved through the selected appearance preset and does
  not enter serialized viewer state independently.
* **Alternatives:**
  * *Clearcoat* — models a transparent lacquer layer, not a diffuse pearly sheen; better
    suited to coated or polished surfaces, not mineral growth-face luster.
  * *Iridescence* — produces thin-film color shifts; pearly luster is a broad, soft
    directional sheen, not a spectral rainbow.
  * *Custom shader contribution* — higher maintenance cost and WebGL/WebGPU portability
    risk for an effect that the built-in sheen layer already covers.
  * *Per-face pearly treatment only* — deferred to SR5, which handles face-local material
    infrastructure; SR2 establishes the whole-surface category so the renderer mapping is
    centralized and testable before face-specific work begins.
* **Consequences:** Sheen would be applied uniformly across the crystal surface for a
  pearly preset, so the shipped catalog does not currently assign that category: the
  reviewed calcite and gypsum evidence is face- or cleavage-specific. Face-local pearly
  treatment is SR5 work. Pearly mapping is tested with an explicit non-catalog fixture.
  Every sheen constant is labeled curated in code and docs. Presets without `luster`
  fall back to `vitreous` (sheen zero), preserving V1 behavior. Tests cover the mapping,
  backward compatibility, and serialized-state round-trips.
* **References:** [Mineral Appearance](../data-model.md#mineral-appearance),
  [Appearance Controls](../viewer-api.md#appearance-controls),
  [SR2 acceptance audit](../sr2-acceptance.md).

# SR8 Descriptive Appearance-Claim Catalogue Acceptance

**Status:** complete. Automated data, renderer-boundary, build, and documentation
gates passed 2026-09-20. SR8 adds catalogue description only; it introduces no shader,
material, geometry, or public-control change, so no human visual review is required.

## Catalogue and provenance

All nine shipped minerals have provenance-backed `appearanceClaims`. The catalogue
records reported colour, diaphaneity, luster, and surface-character observations where
the reviewed source supports them. It preserves the required distinctions for albite
cleavage and twinning, anatase candidate striations, beryl luster/transparency,
fluorite growth layers, forsterite unresolved striations, gypsum cleavage/fibrous
appearance, and the quartz/calcite/pyrite reviewed cases.

Quartz, calcite, and pyrite now also retain their sourced general luster context. The
claims do not turn documented luster vocabulary into RGB, roughness, transmission,
IOR, or procedural measurements; those remain curated renderer mappings. Sources,
access constraints, and the claim review queue remain in the
[surface-rendering acquisition record](sources/surface-rendering-acquisition.md).

## Promotion boundary

`appearanceClaims` is a data-only layer. Validation requires every active
`surfaceProfiles` record to:

* reference an existing `renderer-eligible` claim;
* promote a `growth-face` claim only; and
* retain that claim's exact semantic selector.

An eligible form-ID selector must name a form present in a shipped habit. Candidates,
blocked claims, cleavage, twinning, fibrous, weathered, and descriptive-only claims
cannot become face-routing or material input. The existing promoted records remain
quartz prism striations, calcite basal pearly luster, pyrite cube striations, and
fluorite `{100}` growth steps.

## Automated evidence

`npm run check`, `node scripts/check-docs.mjs`, and `git diff --check` pass. The full
suite contains 506 tests.

Focused coverage in `packages/crystal-data/src/appearance-claims.test.ts` verifies:

* all nine bundled records expose reported, provenance-covered claims;
* unknown controlled-vocabulary values, non-eligible claims without a reason, and
  renderer-eligible non-growth-face claims reject;
* missing claim provenance rejects;
* a profile cannot promote an absent, descriptive-only, blocked, or candidate claim;
* profile and claim selectors must agree, while equivalent Miller fields remain
  independent of JSON key ordering; and
* renderer-eligible form selectors must refer to a shipped form.

`packages/crystal-viewer/src/sr7-acceptance.test.ts` loads a record whose twinning
claim is changed from blocked to candidate and given a selector. Its resolved appearance
and effective surface-profile list remain identical to the unmodified albite record:
descriptive claims do not alter material parameters or select faces.

## Review boundary

No owner feedback is needed to accept SR8 because it has no visual realization. Request
scientific review before promoting any candidate to `surfaceProfiles`, and request human
visual review only when that promotion introduces or changes a renderer effect.

## Verification

```sh
npm run check
node scripts/check-docs.mjs
git diff --check
```

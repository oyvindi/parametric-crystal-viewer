# 0011 — Demo Production Bundling with tsdown

* **Status:** accepted.
* **Context:** The demos in `crystal-demo` load `@crystal/viewer` through browser
  import maps that remap `three` and `three/addons/` into `node_modules/three/`. The
  viewer (`crystal-viewer/src/index.ts`) imports `HDRLoader` and `EXRLoader` from
  `three/addons/loaders/`. Locally this resolves, but the GitHub Pages deploy
  (`deploy-demo.yml`) staged only `node_modules/three/build/` and omitted
  `three/examples/jsm/`, so every demo 404'd on `EXRLoader.js` / `HDRLoader.js` at
  module load and failed to initialize. A production build step that produces
  minified, self-contained bundles — and that the demos consume — was also desired.
  The [architecture](../architecture.md#technology-stack) recommends Vite as the
  build tool.

* **Decision:** Add a `tsdown` bundle step for `crystal-viewer` that inlines `three`,
  the three.js addons, and the `@crystal/*` workspace packages into minified ESM in
  `packages/crystal-viewer/bundle/`. The demos' import maps now resolve only
  `@crystal/viewer` and `@crystal/viewer/component` to those bundles; the `three`,
  `three/addons/`, and `@crystal/*` import-map entries are removed because the
  bundle is self-contained (the shared chunk is referenced by relative path, so it
  needs no import-map entry). `tsdown` runs after `tsc --build` so the `@crystal/*`
  `dist/` outputs exist for resolution. The library build (`tsc --build`) is
  unchanged; the bundle is a separate `build:bundle` / `build:demo` script that the
  `serve` script and the Pages workflow run. The `bundle/` output is gitignored. The
  Pages workflow runs `build:pages`, which stages the complete demo static directory,
  generated bundle, and required CIF fixtures into `dist/pages`, then rejects any
  unresolved relative HTML or ESM-module reference before upload.

* **Alternatives:**
  * *Vite* — recommended by architecture and capable of the same bundling, plus HTML
    entry rewriting, an HMR dev server, and automatic shared-chunk deduplication. It
    is the heavier choice: a dev-server dependency and a per-demo build config. No
    demo imports `three` directly today (only `@crystal/viewer` /
    `@crystal/viewer/component`), so a single self-contained viewer bundle removes
    the missing-addons failure without Vite's machinery. Vite remains the fallback if
    demos ever import `three` directly (which would risk a second three copy beside
    the inlined one) or if HMR is wanted for demo development.
  * *Stop-gap only* (copy `three/examples/jsm/` into staging) — fixes the 404 with no
    build tooling, but keeps raw unminified three.js and addons on Pages and leaves
    the hand-maintained import map / staging script that caused the failure. Does not
    meet the minified-bundle goal.
  * *Keep `@crystal/*` external in the bundle* — would require the demos' import maps
    and the deploy staging to keep mapping `@crystal/core|data|three` to their
    `dist/`, partially defeating the simplification. Rejected in favor of a fully
    self-contained bundle.

* **Consequences:** The Pages 404 class of bug is removed structurally: the addons are
  bundled, so they cannot be missing from staging. Demos ship one minified bundle per
  entry (~757 KB total, ~192 KB gzipped, including three.js and all workspace code).
  The deploy staging step simplifies to copying the demo HTML, the `bundle/` output,
  and the CIF fixtures fetched by `structure.html`. The constraint to record: no demo
  may import `three` or `three/addons/` directly, or it would get a second three copy
  alongside the inlined one (instanceof mismatches, doubled size); such a demo would
  require moving to Vite's shared-chunk model. Artifact validation also prevents a
  deploy omission of a project-owned demo module such as `projection-control.js`.
  Local development still uses
  `serve-demo.mjs` against the built bundle (the `serve` script builds it first);
  unbundled source-with-HMR is not provided.
* **References:** [Technology Stack](../architecture.md#technology-stack),
  [Package Dependencies and Ownership](../architecture.md#package-dependencies-and-ownership),
  `packages/crystal-viewer/tsdown.config.ts`, `.github/workflows/deploy-demo.yml`.

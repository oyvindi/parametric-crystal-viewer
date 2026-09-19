# 0013 — Demo UI and Build Tooling

* **Status:** accepted. Partially supersedes the demo build-path deferral in
  [ADR 0011](0011-demo-production-bundling.md).
* **Context:** The demos in `crystal-demo` are a development and reference interface,
  not the shipped product. The shipped product is the framework-agnostic
  `crystal-viewer` Web Component. The architecture's no-UI-framework constraint was
  intended for the viewer and scientific packages, but as written it also constrained
  the demos. The demos currently use hand-written inline `<style>` blocks duplicated
  across 14 HTML files with no shared stylesheet, no UI framework, and no build tool
  beyond a zero-dependency static file server ([ADR 0011](0011-demo-production-bundling.md)).
  The duplicated CSS drifts between demos, the dark-theme tokens are inconsistent, and
  visual iteration during surface-rendering work is slowed by the lack of HMR and the
  manual rebuild-then-refresh cycle. [ADR 0011](0011-demo-production-bundling.md)
  explicitly deferred Vite and documented it as the fallback "if demos ever import
  `three` directly or if HMR is wanted."

* **Decision:** Allow `crystal-demo` to adopt:
  * **Bootstrap** as a CSS framework for demo presentation, installed through npm and
    bundled at build time (not loaded from a CDN), so demos do not depend on a remote
    runtime asset.
  * **Vite** as the demo build tool and dev server, providing HMR during visual
    iteration and an optimized production build for the GitHub Pages deploy.
  * A **shared `demo.css`** extracted from the existing inline styles, covering the
    common dark-theme tokens, panel layout, form-row, and status classes.

  These are demo-only dependencies confined to the `crystal-demo` package. The
  `crystal-viewer` Web Component, `crystal-core`, `crystal-data`, and `crystal-three`
  remain framework- and tooling-neutral; none of them import Bootstrap, Vite, or any
  demo stylesheet.

* **Alternatives:**
  * *Status quo* (inline CSS, no framework, static server) — works and has no new
    dependencies, but the duplicated CSS drifts, the dark-theme tokens are
    inconsistent across demos, and there is no HMR for the visual iteration that
    surface-rendering work requires.
  * *Shared CSS only, no Bootstrap or Vite* — removes the duplication but keeps
    hand-rolled dark-theme form controls and the static-serve model; does not address
    the HMR need that [ADR 0011](0011-demo-production-bundling.md) already identified.
  * *Bootstrap via CDN* — rejected. The surface-rendering plan ([SR1](../surface-rendering-plan.md#sr1--lighting-and-presentation-defaults))
    and the existing project-owned-default principle require that demos not depend on
    a remote runtime asset. Bootstrap is installed through npm and bundled by Vite.
  * *A heavier UI framework (React/Vue/Svelte)* — rejected. The demos use plain HTML
    controls (select, range, checkbox, button); a component framework would add
    disproportionate weight and a build/runtime model that the demos do not need.

* **Consequences:**
  * Demo presentation and build tooling are confined to `crystal-demo`; the viewer and
    scientific packages are unaffected and remain embeddable without a host framework.
  * This supersedes [ADR 0011](0011-demo-production-bundling.md) for the **demo build
    path**: the static-serve + import-map demo model is replaced by a Vite dev server
    and Vite production build. The viewer library build (`tsc --build`) is unchanged.
    Vite resolves and bundles `@crystal/viewer`, `three`, the three.js addons, and the
    `@crystal/*` workspace packages into the demo build, deduplicating `three` into a
    single shared chunk. The `tsdown` viewer-bundle step, the `bundle/` output, and the
    `build:bundle` / `serve-demo.mjs` scripts are removed; no demo may produce a second
    `three` copy beside the one the viewer depends on.
  * `scripts/build-pages.mjs` and `.github/workflows/deploy-demo.yml` need updating to
    consume Vite build output instead of staging raw HTML and the `tsdown` bundle.
  * `scripts/serve-demo.mjs` is retained only for the surface-baseline capture script,
    which serves the Vite build output; local development uses the Vite dev server.
  * Bootstrap CSS adds a bundled dependency (~190 KB uncompressed, far less gzipped and
    tree-shakeable to the CSS actually imported); it is bundled, not fetched at runtime.
  * The existing `projection-control.js` runtime style injection should be folded into
    the shared `demo.css`.

* **References:** [Technology Stack](../architecture.md#technology-stack),
  [Package Dependencies and Ownership](../architecture.md#package-dependencies-and-ownership),
  [ADR 0011](0011-demo-production-bundling.md),
  [surface-rendering plan](../surface-rendering-plan.md).

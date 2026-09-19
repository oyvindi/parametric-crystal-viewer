import { defineConfig } from "tsdown";

/**
 * Production bundle for the viewer Web Component.
 *
 * Inlines `three`, the three.js addons, and the `@crystal/*` workspace packages
 * into a self-contained ESM bundle so demos resolve a single file per entry and
 * never reach into `node_modules/three/examples/jsm/` at runtime (the source of
 * the GitHub Pages 404s on HDRLoader.js / EXRLoader.js).
 *
 * Run after `tsc --build` so the `@crystal/*` `dist/` outputs exist for
 * resolution. Output lands in `bundle/` next to this config.
 */
export default defineConfig({
    entry: ["src/index.ts", "src/component.ts"],
    format: "esm",
    outDir: "bundle",
    minify: true,
    sourcemap: false,
    dts: false,
    deps: {
        alwaysBundle: [/^three(\/|$)/, /^@crystal\//],
        onlyBundle: false,
    },
});

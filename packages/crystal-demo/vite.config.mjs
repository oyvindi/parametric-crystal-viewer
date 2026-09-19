import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const dir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(dir, "../..");

const entries = {};
for (const f of readdirSync(dir)) {
  if (f.endsWith(".html")) entries[f.replace(/\.html$/, "")] = resolve(dir, f);
}

const demoIndex = "/packages/crystal-demo/index.html";

// Augment Vite's default URL banner with the demo index path, so the console
// points straight to the demos instead of the bare project root.
function demoIndexUrlPlugin() {
  return {
    name: "crystal-demo-index-url",
    configureServer(server) {
      const original = server.printUrls.bind(server);
      server.printUrls = function printDemoIndexUrl() {
        original();
        const urls = server.resolvedUrls?.local ?? [];
        const base = urls[0] ?? "";
        if (base) server.config.logger.info(`  ➜  Demo index: ${base.replace(/\/$/, "")}${demoIndex}`);
      };
    },
  };
}

export default defineConfig(({ command }) => {
  const serve = command === "serve";
  return {
    root: serve ? projectRoot : dir,
    base: "./",
    plugins: serve ? [demoIndexUrlPlugin()] : [],
    server: {
      port: 5173,
      fs: { allow: [projectRoot] },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: { input: entries },
    },
  };
});

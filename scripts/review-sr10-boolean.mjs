// Builds an isolated review fixture; never changes production sources or baselines.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "artifacts/sr10-boolean");
const bundle = join(output, "bundle");
const chrome = process.env.CHROME_BIN ?? "google-chrome";
const seed = 0x5f3759df;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const baselinePath = join(root, "docs/baselines/sr10/fluorite-terraced.png");
const baseline = await readFile(baselinePath);
let substituted = false;

await mkdir(output, { recursive: true });
await build({
  configFile: false,
  root: join(root, "packages/crystal-demo"), base: "./", logLevel: "warn",
  plugins: [{
    name: "sr10-isolated-review-substitution",
    transform(source, id) {
      if (!id.endsWith("/crystal-three/dist/display-growth.js")) return null;
      const declaration = "export function createTerracedFluoriteDisplayGeometry(";
      assert.ok(source.includes(declaration), "Accepted generator signature changed; review the harness.");
      substituted = true;
      return source.replace(declaration, "function acceptedDisplay(") + `
import { unionTerracedCube } from "./experimental/box-union.js";
import { createCornerGrowthOperands } from "./experimental/corner-growth.js";
export function createTerracedFluoriteDisplayGeometry(core, seed) {
  const accepted = acceptedDisplay(core, seed);
  const mode = new URLSearchParams(location.search).get("composition") || "accepted";
  if (mode !== "union" && mode !== "corners") return accepted;
  const start = performance.now();
  const edgeOperands = mode === "corners" ? createCornerGrowthOperands(core, accepted, seed) : [];
  const result = unionTerracedCube(core, accepted, edgeOperands);
  if (result.status !== "valid") throw new Error(JSON.stringify(result.diagnostic));
  globalThis.__sr10Union = { composition: mode, addedOperands: edgeOperands.length, milliseconds: performance.now() - start, rectangles: result.rectangles,
    triangles: result.geometry.triangleFaces.length, components: result.geometry.components.length,
    cpuBufferBytes: result.geometry.positions.byteLength + result.geometry.triangleFaces.byteLength };
  return result.geometry;
}
`;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // Keep the accepted scene byte-comparable; optional changes occur only on request.
        return html.replace('viewer.resetCamera();', `
if (params.get("composition") === "idealized") viewer.setDisplayGrowth("idealized");
if (params.get("opaque") === "1") viewer.setAppearanceField("transmission", 0);
viewer.resetCamera();
if (params.get("rotated") === "1") viewer.rotateModel(0.31, 0.58, 0.17);
viewer.renderOnce();
document.title = "SR10 " + (params.get("composition") || "accepted") + " — review only";`)
          .replace('camera: viewer.getState().camera,', 'camera: viewer.getState().camera, appearance: viewer.getAppearance(), experiment: globalThis.__sr10Union ?? null,');
      },
    },
  }],
  build: { outDir: bundle, emptyOutDir: true, chunkSizeWarningLimit: 1000, rollupOptions: { input: join(root, "packages/crystal-demo/display-growth-baseline.html") } },
});
assert.ok(substituted, "Review build did not substitute the generator.");
const rows = [
  ["Pinned transmission", ""], ["Rotated transmission", "&rotated=1"], ["Opaque control", "&opaque=1"],
];
await writeFile(join(bundle, "index.html"), `<!doctype html><meta charset="utf-8"><title>SR10 union spike — review only</title>
<style>body{font:18px system-ui;max-width:1000px;margin:40px auto}td,th{padding:12px;text-align:left}</style>
<h1>SR10 display-growth comparison</h1>
<p>Compare the accepted preset, union-only cleanup, and the new shallow edge/corner growth.
All views use the same material, camera and environment. Corner growth adds 80 staggered blocks spanning adjacent faces.
The corner-growth visual direction is approved; production integration remains pending.</p>
<table><tr><th>Scene</th><th>Accepted</th><th>Union only</th><th>New corner growth</th><th>Idealized core</th></tr>
${rows.map(([title, suffix]) => `<tr><td>${title}</td>${["accepted", "union", "corners", "idealized"].map(mode => `<td><a href="display-growth-baseline.html?seed=${seed}&composition=${mode}${suffix}">${mode}</a></td>`).join("")}</tr>`).join("\n")}</table>
<p>Compare terrace readability through transmission, corner seams, silhouette and the opaque control.
Use pointer drag to inspect other angles. Assess whether the staggered blocks interrupt the straight corners without creating a frame.</p>`);
console.log(`Review bundle: ${bundle}`);
if (process.argv.includes("--build-only")) process.exit(0);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${command} timed out`)); }, 60_000);
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", code => { clearTimeout(timeout); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr}`)); });
  });
}
const port = await new Promise((resolve, reject) => {
  const server = createServer(); server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
});
const server = spawn(process.execPath, [join(root, "scripts/serve-demo.mjs"), String(port), bundle], { cwd: root, stdio: "ignore" });
const baseUrl = `http://127.0.0.1:${port}/display-growth-baseline.html?seed=${seed}`;
// Decode Chrome's 8-bit RGB/RGBA PNGs for pixel evidence without a new dependency.
function pixels(png) {
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  const width = png.readUInt32BE(16); const height = png.readUInt32BE(20);
  assert.equal(png[24], 8); assert.ok([2, 6].includes(png[25])); assert.equal(png[28], 0);
  const channels = png[25] === 2 ? 3 : 4; const stride = width * channels; const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)); const result = Buffer.alloc(width * height * channels);
  const paeth = (a, b, c) => { const p = a + b - c; const x = Math.abs(p - a); const y = Math.abs(p - b); const z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const index = row * stride + x; const left = x >= channels ? result[index - channels] : 0;
      const up = row ? result[index - stride] : 0; const corner = row && x >= channels ? result[index - stride - channels] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
      result[index] = (raw[row * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, channels, data: result };
}
function difference(left, right) {
  const a = pixels(left); const b = pixels(right);
  assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  let changedPixels = 0; let absolute = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    let changed = false;
    for (let c = 0; c < 3; c++) { const delta = Math.abs(a.data[i * a.channels + c] - b.data[i * b.channels + c]); absolute += delta; changed ||= delta !== 0; }
    changedPixels += Number(changed);
  }
  return { changedPixels, percent: changedPixels / (a.width * a.height) * 100, meanAbsoluteRgbDifference: absolute / (a.width * a.height * 3) };
}
const captures = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(baseUrl)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Review server failed to start.");
  for (const [scene, suffix] of [["pinned", ""], ["rotated", "&rotated=1"], ["opaque", "&opaque=1"], ["repeat", ""]]) {
    for (const mode of scene === "repeat" ? ["accepted", "union", "corners"] : ["accepted", "union", "corners", "idealized"]) {
      const name = `${scene}-${mode}.png`;
      const { stdout } = await run(chrome, ["--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=960,720", "--virtual-time-budget=2500", `--screenshot=${join(output, name)}`, "--dump-dom", `${baseUrl}&composition=${mode}${suffix}`]);
      const match = stdout.match(/<output id="display-growth-baseline-result" hidden="">([^<]+)<\/output>/);
      assert.ok(match, `No completed scene for ${name}`);
      const state = JSON.parse(match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
      captures.push({ name, sha256: hash(await readFile(join(output, name))), state });
      console.log(`Captured ${name}${state.experiment ? ` (${state.experiment.triangles} triangles, ${state.experiment.milliseconds.toFixed(1)} ms)` : ""}`);
    }
  }
  const pixelComparisons = {};
  for (const scene of ["pinned", "rotated", "opaque"]) pixelComparisons[scene] = difference(await readFile(join(output, `${scene}-accepted.png`)), await readFile(join(output, `${scene}-union.png`)));
  const cornerComparisons = {};
  for (const scene of ["pinned", "rotated", "opaque"]) cornerComparisons[scene] = difference(await readFile(join(output, `${scene}-union.png`)), await readFile(join(output, `${scene}-corners.png`)));
  const manifest = {
    pixelComparisons, cornerComparisons,
    baselinePixelDifference: difference(baseline, await readFile(join(output, "pinned-accepted.png"))),
    status: "experimental; corner-growth visual direction approved; production integration pending", capturedAt: new Date().toISOString(),
    viewport: { width: 960, height: 720, deviceScaleFactor: 1 },
    acceptedBaselineSha256: hash(baseline), acceptedBaselineByteIdentical: hash(baseline) === captures[0].sha256,
    repeatedPngByteIdentical: ["accepted", "union", "corners"].every(mode => captures.find(c => c.name === `pinned-${mode}.png`).sha256 === captures.find(c => c.name === `repeat-${mode}.png`).sha256),
    platform: { chrome: (await run(chrome, ["--version"])).stdout.trim(), node: process.version, os: `${process.platform} ${process.arch}` },
    captures,
  };
  assert.equal(hash(await readFile(baselinePath)), hash(baseline), "Accepted baseline was modified.");
  await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ acceptedBaselineByteIdentical: manifest.acceptedBaselineByteIdentical, repeatedPngByteIdentical: manifest.repeatedPngByteIdentical }));
  assert.ok(manifest.repeatedPngByteIdentical, "Review capture is not repeatable; investigate before drawing conclusions.");
} finally { server.kill("SIGTERM"); }

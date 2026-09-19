import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const label = process.argv[2] ?? "sr0";
if (!/^sr\d+$/.test(label)) throw new Error(`Invalid baseline label: ${label}`);
const output = join(root, "docs", "baselines", label);
const minerals = ["albite", "anatase", "beryl", "calcite", "fluorite", "forsterite", "gypsum", "pyrite", "quartz"];
const chrome = process.env.CHROME_BIN ?? "google-chrome";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

await mkdir(output, { recursive: true });
const port = await freePort();
const server = spawn(process.execPath, [join(root, "scripts", "serve-demo.mjs"), String(port)], { cwd: root, stdio: "ignore" });

try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/packages/crystal-demo/surface-baseline.html`);
      if (response.ok) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
    if (attempt === 49) throw new Error("Demo server did not become ready.");
  }

  const scenes = [];
  for (const mineral of minerals) {
    const screenshot = join(output, `${mineral}.png`);
    const url = `http://127.0.0.1:${port}/packages/crystal-demo/surface-baseline.html?mineral=${mineral}`;
    const timingUrl = `${url}&timing=1`;
    await run(chrome, [
      "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader",
      "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=960,720",
      `--screenshot=${screenshot}`, url,
    ], { cwd: root });
    let match;
    for (let attempt = 1; attempt <= 3 && !match; attempt += 1) {
      const { stdout } = await run(chrome, [
        "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader",
        "--virtual-time-budget=2500", "--dump-dom", timingUrl,
      ], { cwd: root });
      match = stdout.match(/<output id="surface-baseline-result" hidden="">([^<]+)<\/output>/);
    }
    if (!match) throw new Error(`No timing result produced for ${mineral}.`);
    scenes.push(JSON.parse(match[1].replaceAll("&quot;", '"')));
  }

  const manifest = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    viewport: { width: 960, height: 720, deviceScaleFactor: 1 },
    presentation: { environment: "project-owned procedural studio gradient", environmentIntensity: 1, environmentRotation: [0, 0, 0], backgroundZoom: 1, toneMapping: "agx", exposure: 1 },
    timing: { method: "requestAnimationFrame intervals in a fixed one-second window after one warm-up frame", note: "Hardware- and browser-dependent; compare only on the recorded platform." },
    platform: { chrome: (await run(chrome, ["--version"])).stdout.trim(), node: process.version, os: `${process.platform} ${process.arch}` },
    scenes,
  };
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured ${scenes.length} ${label.toUpperCase()} scenes in ${output}`);
} finally {
  server.kill("SIGTERM");
}

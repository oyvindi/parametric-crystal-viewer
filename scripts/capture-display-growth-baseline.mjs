import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = join(root, "docs", "baselines", "sr10");
const chrome = process.env.CHROME_BIN ?? "google-chrome";
const seed = 0x5f3759df;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject); child.once("exit", code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

await mkdir(output, { recursive: true });
const port = await freePort();
const server = spawn(process.execPath, [join(root, "scripts", "serve-demo.mjs"), String(port), join(root, "packages", "crystal-demo", "dist")], { cwd: root, stdio: "ignore" });
const url = `http://127.0.0.1:${port}/display-growth-baseline.html?seed=${seed}`;
try {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
    if (attempt === 49) throw new Error("Demo server did not become ready.");
  }
  await run(chrome, ["--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=960,720", "--virtual-time-budget=2500", `--screenshot=${join(output, "fluorite-terraced.png")}`, url], { cwd: root });
  const { stdout } = await run(chrome, ["--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--virtual-time-budget=2500", "--dump-dom", url], { cwd: root });
  const match = stdout.match(/<output id="display-growth-baseline-result" hidden="">([^<]+)<\/output>/);
  if (!match) throw new Error("No display-growth baseline result produced.");
  const manifest = {
    schemaVersion: 1, capturedAt: new Date().toISOString(), viewport: { width: 960, height: 720, deviceScaleFactor: 1 },
    presentation: { environment: "project-owned procedural studio gradient", environmentIntensity: 1, environmentRotation: [0, 0, 0], backgroundVisible: true, backgroundZoom: 1, toneMapping: "agx", exposure: 1, surfaceDetail: { enabled: false, strength: 0.35 } },
    scene: JSON.parse(match[1].replaceAll("&quot;", '"')), platform: { chrome: (await run(chrome, ["--version"])).stdout.trim(), node: process.version, os: `${process.platform} ${process.arch}` },
  };
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured SR10 Terraced fluorite baseline in ${output}`);
} finally { server.kill("SIGTERM"); }

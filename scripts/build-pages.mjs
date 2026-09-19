import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extname, join, relative, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist", "pages");
const demoBuild = join(root, "packages", "crystal-demo", "dist");
const demoOutput = join(output, "packages", "crystal-demo");
const fixturesSource = join(root, "packages", "crystal-core", "test-fixtures", "m5");
const fixturesOutput = join(output, "packages", "crystal-core", "test-fixtures", "m5");

function isWithin(rootPath, candidate) {
    return candidate === rootPath || candidate.startsWith(rootPath + "/");
}

function resolveReference(source, specifier) {
    const pathname = specifier.split(/[?#]/, 1)[0];
    if (!pathname || !(pathname.startsWith(".") || pathname.startsWith("/"))) return undefined;
    return pathname.startsWith("/")
        ? resolve(output, `.${pathname}`)
        : fileURLToPath(new URL(pathname, pathToFileURL(source)));
}

async function filesIn(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await filesIn(path));
        else if (entry.isFile()) files.push(path);
    }
    return files;
}

async function validateReferences() {
    const stagedFiles = await filesIn(output);
    const sources = stagedFiles.filter((path) => [".html", ".js", ".mjs"].includes(extname(path)));
    const missing = [];
    const moduleImport = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
    const htmlReference = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;

    for (const source of sources) {
        const text = await readFile(source, "utf8");
        const references = [];
        for (const match of text.matchAll(moduleImport)) references.push(match[1] ?? match[2]);
        if (extname(source) === ".html") {
            for (const match of text.matchAll(htmlReference)) references.push(match[1]);
        }
        for (const specifier of references) {
            const target = resolveReference(source, specifier);
            if (!target) continue;
            if (!isWithin(output, target) || !(await stat(target).catch(() => undefined))) {
                missing.push(`${relative(output, source)} -> ${specifier}`);
            }
        }
    }
    if (missing.length) throw new Error(`Pages artifact has unresolved relative references:\n${missing.join("\n")}`);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(demoBuild, demoOutput, { recursive: true });
await cp(fixturesSource, fixturesOutput, { recursive: true });
await writeFile(join(output, "index.html"), '<!DOCTYPE html>\n<meta http-equiv="refresh" content="0; url=packages/crystal-demo/index.html">\n<a href="packages/crystal-demo/index.html">Demos</a>\n');
await validateReferences();
console.log(`Built and validated Pages artifact in ${relative(root, output)}.`);

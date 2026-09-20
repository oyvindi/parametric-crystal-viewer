import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] ?? 5173);
const rootPath = resolve(process.argv[3] ?? defaultRoot);

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let path = normalize(join(rootPath, decodeURIComponent(url.pathname)));
    if (!path.startsWith(rootPath)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }
    try {
        const info = await stat(path);
        if (info.isDirectory()) path = join(path, "index.html");
        const body = await readFile(path);
        res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
        res.end(body);
    } catch {
        res.writeHead(404);
        res.end("Not found");
    }
});

server.listen(port, () => {
    console.log(`Demo server:  http://localhost:${port}`);
    const prefix = existsSync(join(rootPath, "index.html")) ? "" : "packages/crystal-demo/";
    for (const [label, file] of [["Index", "index.html"], ["Fluorite", "fluorite.html"], ["Display growth", "display-growth-baseline.html"]]) {
        const relativePath = `${prefix}${file}`;
        if (existsSync(join(rootPath, relativePath))) {
            console.log(`${label}: http://localhost:${port}/${relativePath}`);
        }
    }
});

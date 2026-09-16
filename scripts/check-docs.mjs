import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const files = [];
function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['.git','node_modules','dist'].includes(entry.name)) continue;
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(path); else if (path.endsWith('.md')) files.push(path);
    }
}
walk('.');
const anchors = (text) => {
    const counts = new Map();
    return new Set([...text.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => {
        const base = m[1].toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
        const count = counts.get(base) ?? 0; counts.set(base, count + 1);
        return count ? `${base}-${count}` : base;
    }));
};
const errors = [];
for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if ((content.match(/^```/gm) ?? []).length % 2) errors.push(`${file}: unmatched code fence`);
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1];
        if (/^[a-z]+:/i.test(target)) continue;
        const [name, anchor] = target.split('#');
        const path = name ? resolve(dirname(file), decodeURIComponent(name)) : file;
        if (!existsSync(path)) errors.push(`${file}: missing ${target}`);
        else if (anchor && path.endsWith('.md') && !anchors(readFileSync(path, 'utf8')).has(decodeURIComponent(anchor))) errors.push(`${file}: missing anchor ${target}`);
    }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Checked local links, heading anchors and code fences in ${files.length} Markdown files.`);

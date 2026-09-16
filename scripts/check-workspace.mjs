import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const allowed = { core: [], data: ['core'], three: ['core'], viewer: ['core','data','three'], demo: ['viewer'] };
for (const [name, dependencies] of Object.entries(allowed)) {
    const root = new URL(`../packages/crystal-${name}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('package.json', root)));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
        if (dependency.startsWith('@crystal/')) assert.ok(dependencies.includes(dependency.slice(9)), `${name} cannot depend on ${dependency}`);
        if (name === 'core') assert.fail('Core must have no runtime dependencies');
    }
    for (const file of readdirSync(new URL('src/', root), { recursive: true }).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
        const source = readFileSync(new URL(`src/${file}`, root), 'utf8')
            // Strip comments so JSDoc code examples are not mistaken for imports.
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(^|\n)\s*\/\/.*$/g, '$1');
        for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
            const specifier = match[1];
            if (specifier.startsWith('@crystal/')) assert.ok(dependencies.includes(specifier.slice(9)), `${name}: forbidden import ${specifier}`);
            if (name === 'core') assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), `Core external import: ${specifier}`);
        }
    }
}
console.log('Workspace dependency boundaries passed.');

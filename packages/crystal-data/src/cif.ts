import type { Diagnostic, Result } from "@crystal/core";

/**
 * Minimal CIF 1.1 parser. Tokenizes data blocks into scalar tag-value pairs and
 * `loop_` tables. CIF 2.0 and unsupported constructs are detected by the importer;
 * this parser only structures text. See the [V1 import boundary](../../docs/data-model.md#v1-import-boundary).
 */

export interface CifLoop {
    readonly tags: readonly string[];
    readonly rows: readonly (readonly string[])[];
}

export interface CifBlock {
    readonly name: string;
    readonly scalars: ReadonlyMap<string, string>;
    readonly loops: readonly CifLoop[];
}

export interface CifFile {
    readonly blocks: readonly CifBlock[];
}

function tokenize(line: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    const s = line;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i]!)) i++;
        if (i >= s.length) break;
        const ch = s[i]!;
        if (ch === "'" || ch === '"') {
            const close = s.indexOf(ch, i + 1);
            if (close < 0) { tokens.push(s.slice(i + 1)); break; }
            tokens.push(s.slice(i + 1, close));
            i = close + 1;
        } else {
            let end = i;
            while (end < s.length && !/\s/.test(s[end]!)) end++;
            tokens.push(s.slice(i, end));
            i = end;
        }
    }
    return tokens;
}

/** Parses CIF 1.1 text into data blocks. Errors use `data.cif.parse` codes. */
export function parseCif(text: string): Result<CifFile> {
    if (text.includes("version_cif_2.0") || /\bdata_[^\s]*\s.*\bcif_2\.0\b/i.test(text)) {
        return err("data.cif.unsupported-version", "CIF 2.0 is not supported in V1.");
    }
    const rawLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const lines: string[] = [];
    // Strip full-line comments; preserve line numbers for diagnostics via a parallel array.
    const lineNumbers: number[] = [];
    rawLines.forEach((line, index) => {
        if (/^\s*#/.test(line)) return;
        lines.push(line);
        lineNumbers.push(index + 1);
    });

    const blocks: CifBlock[] = [];
    let pos = 0;
    while (pos < lines.length) {
        const tokens = tokenize(lines[pos]!);
        if (tokens.length === 0) { pos++; continue; }
        if (tokens[0] === "global_") return err("data.cif.unsupported-construct", "global_ blocks are not supported.", { line: lineNumbers[pos] });
        if (tokens[0] === "save_") return err("data.cif.unsupported-construct", "save_ frames are not supported.", { line: lineNumbers[pos] });
        if (tokens[0]!.startsWith("save_")) return err("data.cif.unsupported-construct", "save_ frames are not supported.", { line: lineNumbers[pos] });
        if (!tokens[0]!.startsWith("data_")) { pos++; continue; }
        const block = parseBlock(lines, lineNumbers, pos);
        if (!block.ok) return block;
        blocks.push(block.value);
        pos = block.value.next;
    }
    if (!blocks.length) return err("data.cif.missing-block", "No data block found.");
    return { ok: true, value: { blocks }, diagnostics: [] };
}

interface ParseBlockResult extends CifBlock { readonly next: number; }

function parseBlock(lines: string[], lineNumbers: number[], start: number): Result<ParseBlockResult> {
    const name = tokenize(lines[start]!)[0]!.slice("data_".length);
    const scalars = new Map<string, string>();
    const loops: CifLoop[] = [];
    let pos = start + 1;
    while (pos < lines.length) {
        const tokens = tokenize(lines[pos]!);
        if (tokens.length === 0) { pos++; continue; }
        const head = tokens[0]!;
        if (head.startsWith("data_") || head === "global_") break;
        if (head === "save_") break;
        if (head === "loop_") {
            const loop = parseLoop(lines, lineNumbers, pos);
            if (!loop.ok) return loop;
            loops.push(loop.value.loop);
            pos = loop.value.next;
            continue;
        }
        if (head.startsWith("_")) {
            // scalar tag value; value may be on the same line or a ;-delimited block.
            const tag = head;
            if (tokens.length >= 2) {
                scalars.set(tag, tokens.slice(1).join(" "));
                pos++;
            } else {
                // ;-delimited multi-line value on the following line(s).
                const next = pos + 1;
                if (next < lines.length && lines[next]!.trimStart().startsWith(";")) {
                    const parts: string[] = [];
                    let p = next;
                    parts.push(lines[p]!.trimStart().slice(1));
                    p++;
                    while (p < lines.length && !lines[p]!.trimStart().startsWith(";")) { parts.push(lines[p]!); p++; }
                    scalars.set(tag, parts.join("\n"));
                    pos = p + 1;
                } else {
                    pos++;
                }
            }
            continue;
        }
        // Unexpected token outside a loop; skip.
        pos++;
    }
    return { ok: true, value: { name, scalars, loops, next: pos }, diagnostics: [] };
}

interface ParseLoopResult { readonly loop: CifLoop; readonly next: number; }

function parseLoop(lines: string[], lineNumbers: number[], start: number): Result<ParseLoopResult> {
    let pos = start + 1;
    const tags: string[] = [];
    while (pos < lines.length) {
        const tokens = tokenize(lines[pos]!);
        if (tokens.length === 0) { pos++; continue; }
        if (!tokens[0]!.startsWith("_")) break;
        for (const t of tokens) if (t.startsWith("_")) tags.push(t);
        pos++;
    }
    if (!tags.length) return err("data.cif.parse", "loop_ has no tag headers.", { line: lineNumbers[start] });
    const rows: string[][] = [];
    while (pos < lines.length) {
        const tokens = tokenize(lines[pos]!);
        if (tokens.length === 0) { pos++; continue; }
        if (tokens[0]!.startsWith("_") || tokens[0] === "loop_" || tokens[0]!.startsWith("data_") || tokens[0]!.startsWith("save_") || tokens[0] === "global_") break;
        rows.push(tokens);
        pos++;
    }
    return { ok: true, value: { loop: { tags, rows }, next: pos }, diagnostics: [] };
}

function err(code: string, message: string, source?: { line?: number }): Result<never> {
    const diagnostic: Diagnostic = { code, severity: "error", message, ...(source ? { source } : {}) };
    return { ok: false, diagnostics: [diagnostic] };
}

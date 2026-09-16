// Test-only reader for seven pinned COD fixtures. Not a general CIF importer.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Crystallography } from "../crystal.js";
import type { Mat3, Vec3 } from "../lattice.js";
import type { SpaceOperation } from "../symmetry.js";

export const M5_SOURCES = [
    { name: "calcite", cod: "9000095", sha256: "d8a1cf92866da8814ef104b1626117490d9d4fbad823ef5dbf1cd2954488da52", system: "trigonal", group: "-3m", setting: "hexagonal-standard", order: 12, volume: 367.916 },
    { name: "pyrite", cod: "9000594", sha256: "0caef0969b6bcc5697310ab6f4316cbd01daf5fbcb7cfb1b5d6036647548a9d8", system: "cubic", group: "m-3", setting: "cubic-standard", order: 24, volume: 158.921 },
    { name: "anatase", cod: "9015929", sha256: "9df468431a17fa7983e360aed53d9702ea53d7fa31a4a65012e54097daabcd0e", system: "tetragonal", group: "4/mmm", setting: "tetragonal-standard", order: 16, volume: 136.268 },
    { name: "beryl", cod: "9001551", sha256: "04fdde6aa7efdb73f1519426ce84758a90a0aedd3c5de91a5e9579e505ad0e0c", system: "hexagonal", group: "6/mmm", setting: "hexagonal-standard", order: 24, volume: 674.070 },
    { name: "forsterite", cod: "9000319", sha256: "550b8c89c617267d39e7cb6a07fe6f55cd2343453c1c45ec77738bf6fd25d9cd", system: "orthorhombic", group: "mmm", setting: "orthorhombic-standard", order: 8, volume: 290.296 },
    { name: "gypsum", cod: "9013164", sha256: "022d608c9299439dd5a36151d45e0f6753171c50e663fc858ce61cb340c77036", system: "monoclinic", group: "2/m", setting: "monoclinic-b", order: 4, volume: 493.340 },
    { name: "albite", cod: "9000993", sha256: "04850338d389d22973ed2cf32b91a9324e5aaec0e50f7e7a08f1f09bedcb8573", system: "triclinic", group: "-1", setting: "triclinic-standard", order: 2, volume: 659.829 },
] as const;

export function readM5Fixture(source: typeof M5_SOURCES[number]): { crystallography: Crystallography; spaceOperations: SpaceOperation[] } {
    const bytes = readFileSync(new URL(`../../test-fixtures/m5/${source.cod}.cif`, import.meta.url));
    if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw Error(`Changed COD fixture ${source.cod}`);
    const text = bytes.toString();
    const numeric = (tag: string) => {
        const value = text.match(new RegExp(`^${tag}\\s+([0-9.]+)$`, "m"))?.[1];
        if (!value) throw Error(`Missing numeric fixture tag ${tag}`);
        return Number(value);
    };
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(line => /^_(space_group_symop_operation_xyz|symmetry_equiv_pos_as_xyz)$/.test(line));
    if (start < 0) throw Error("Missing fixture operations");
    const operations: SpaceOperation[] = [];
    for (const line of lines.slice(start + 1)) {
        if (line === "loop_" || line.startsWith("_")) break;
        if (!line.trim()) continue;
        const expressions = line.replace(/^\d+\s+/, "").split(",");
        if (expressions.length !== 3) throw Error(`Unexpected fixture expression ${line}`);
        const translation: number[] = [];
        const linear = expressions.map(expression => {
            const row = [0, 0, 0]; let offset = 0;
            const terms = expression.match(/[+-]?[^+-]+/g) ?? [];
            for (const term of terms) {
                const sign = term.startsWith("-") ? -1 : 1;
                const token = term.replace(/^[+-]/, "");
                const axis = ["x", "y", "z"].indexOf(token);
                if (axis >= 0) row[axis] = row[axis]! + sign;
                else if (/^\d+(\/\d+)?$/.test(token)) {
                    const [n, d = 1] = token.split("/").map(Number); offset += sign * n! / d;
                } else throw Error(`Unsupported fixture token ${term}`);
            }
            translation.push(offset); return row;
        });
        operations.push({ id: `cod-${source.cod}-${operations.length}`, linear: linear as unknown as Mat3, translation: translation as unknown as Vec3 });
    }
    return { crystallography: {
        crystalSystem: source.system, pointGroup: source.group, setting: source.setting,
        unitCell: { a: numeric("_cell_length_a"), b: numeric("_cell_length_b"), c: numeric("_cell_length_c"),
            alpha: numeric("_cell_angle_alpha"), beta: numeric("_cell_angle_beta"), gamma: numeric("_cell_angle_gamma") },
    }, spaceOperations: operations };
}

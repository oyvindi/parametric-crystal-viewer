import type { Mineral } from "./types.js";
import { FLUORITE } from "./minerals/fluorite.js";
import { QUARTZ } from "./minerals/quartz.js";
import { CALCITE } from "./minerals/calcite.js";
import { PYRITE } from "./minerals/pyrite.js";
import { ANATASE } from "./minerals/anatase.js";

import type { Diagnostic, Result } from "@crystal/core";
import { validateMineral } from "./validate.js";
import { dataError, unwrapData } from "./diagnostics.js";

export interface MineralCatalog {
    getMineral(id: string): Mineral | undefined;
    listMinerals(): readonly string[];
}

/** Builds an isolated catalog atomically; duplicate IDs never silently overwrite. */
export function createMineralCatalog(records: unknown): Result<MineralCatalog> {
    if (!Array.isArray(records)) return { ok: false, diagnostics: [{ code: "data.record.invalid-field", severity: "error", message: "Expected an array of mineral records.", path: "" }] };
    const diagnostics: Diagnostic[] = [];
    const byId = new Map<string, Mineral>();
    Array.from(records).forEach((record, i) => {
        const result = validateMineral(record);
        diagnostics.push(...result.diagnostics.map((d) => ({ ...d, path: `/${i}${d.path ?? ""}` })));
        if (!result.ok) return;
        if (byId.has(result.value.id)) diagnostics.push({ code: "data.record.duplicate-id", severity: "error", message: "Mineral IDs must be unique in the catalog.", path: `/${i}/id`, mineralId: result.value.id });
        else byId.set(result.value.id, result.value);
    });
    if (diagnostics.some((d) => d.severity === "error")) return { ok: false, diagnostics };
    const catalog: MineralCatalog = Object.freeze({
        getMineral: (id: string) => byId.get(id),
        listMinerals: () => Object.freeze([...byId.keys()]),
    });
    return { ok: true, value: catalog, diagnostics };
}

const CATALOG = unwrapData(createMineralCatalog([FLUORITE, QUARTZ, CALCITE, PYRITE, ANATASE]));

/** Returns the mineral record for the given stable ID, or undefined. */
export function getMineral(id: string): Mineral | undefined {
    return CATALOG.getMineral(id);
}

/** All cataloged mineral IDs in registration order. */
export function listMinerals(): readonly string[] {
    return CATALOG.listMinerals();
}

/** Catalog IDs and caller-supplied records share the same validated schema. */
export function loadMineral(source: unknown, catalog: MineralCatalog = CATALOG): Mineral {
    if (typeof source !== "string") return unwrapData(validateMineral(source));
    const mineral = catalog.getMineral(source);
    if (!mineral) throw dataError("data.catalog.unknown-mineral", `Unknown mineral "${source}".`, "/mineralId");
    return unwrapData(validateMineral(mineral));
}

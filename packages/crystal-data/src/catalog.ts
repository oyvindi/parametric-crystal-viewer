import type { Mineral } from "./types.js";
import { FLUORITE } from "./minerals/fluorite.js";

const MINERALS: readonly Mineral[] = [FLUORITE];

const BY_ID = new Map(MINERALS.map((m) => [m.id, m]));

/** Returns the mineral record for the given stable ID, or undefined. */
export function getMineral(id: string): Mineral | undefined {
    return BY_ID.get(id);
}

/** All cataloged mineral IDs in registration order. */
export function listMinerals(): readonly string[] {
    return MINERALS.map((m) => m.id);
}

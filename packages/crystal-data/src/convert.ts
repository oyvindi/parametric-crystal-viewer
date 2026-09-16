import type { Crystallography, Morphology } from "@crystal/core";
import type { Mineral, MineralCrystallography, HabitPreset, CrystalFormSetting } from "./types.js";
import { dataError } from "./diagnostics.js";
import { defineMineral } from "./validate.js";

export interface MorphologyRequest {
    /** Habit preset to start from; defaults to the first habit. */
    readonly habitId?: string;
    /** Structural variant (e.g. left/right-handed quartz); defaults to the mineral's primary crystallography. */
    readonly variantId?: string;
    /** Overrides applied on top of the selected habit's development values. */
    readonly formDevelopment?: Readonly<Record<string, number>>;
    /** Overrides applied on top of the selected habit's enabled flags. */
    readonly formEnabled?: Readonly<Record<string, boolean>>;
    readonly morphologyScale?: number;
}

export interface CrystalInput {
    readonly crystallography: Crystallography;
    readonly morphology: Morphology;
}

function toCoreCrystallography(source: MineralCrystallography): Crystallography {
    return {
        crystalSystem: source.crystalSystem,
        unitCell: source.unitCell,
        ...(source.setting !== undefined ? { setting: source.setting } : {}),
        ...(source.pointGroup !== undefined ? { pointGroup: source.pointGroup } : {}),
        ...(source.spaceGroup !== undefined ? { spaceGroup: source.spaceGroup } : {}),
        ...(source.pointOperations !== undefined ? { pointOperations: source.pointOperations } : {}),
        ...(source.spaceOperations !== undefined ? { spaceOperations: source.spaceOperations } : {}),
        ...(source.identityOnly !== undefined ? { identityOnly: source.identityOnly } : {}),
    };
}

/** Resolves a habit preset from a mineral record. */
export function resolveHabit(mineral: Mineral, habitId?: string): HabitPreset {
    if (habitId !== undefined) {
        const habit = mineral.habits.find((h) => h.id === habitId);
        if (!habit) throw dataError("data.request.unknown-habit", `Unknown habit "${habitId}" for mineral "${mineral.id}".`, "/habitId");
        return habit;
    }
    const habit = mineral.habits[0];
    if (!habit) throw dataError("data.request.unknown-habit", "The mineral has no morphology habits.", "/habitId");
    return habit;
}

function applyOverrides(habit: HabitPreset, request: MorphologyRequest): readonly CrystalFormSetting[] {
    return habit.forms.map((form) => {
        const dev = request.formDevelopment?.[form.id];
        const en = request.formEnabled?.[form.id];
        return {
            ...form,
            ...(dev !== undefined ? { development: dev } : {}),
            ...(en !== undefined ? { enabled: en } : {}),
        };
    });
}

/** Resolves the crystallography for the selected variant, or the mineral's primary crystallography. */
export function resolveCrystallography(mineral: Mineral, variantId?: string): MineralCrystallography {
    if (variantId !== undefined) {
        const variant = mineral.variants?.find((v) => v.id === variantId);
        if (!variant) throw dataError("data.request.unknown-variant", `Unknown variant "${variantId}" for mineral "${mineral.id}".`, "/variantId");
        return variant.crystallography;
    }
    return mineral.crystallography;
}

/** Converts a mineral record and morphology request into core generator inputs. */
export function createCrystalInput(mineral: Mineral, request: MorphologyRequest = {}): CrystalInput {
    mineral = defineMineral(mineral);
    const habit = resolveHabit(mineral, request.habitId);
    const crystallography = resolveCrystallography(mineral, request.variantId);
    for (const key of ["formDevelopment", "formEnabled"] as const) {
        for (const id of Object.keys(request[key] ?? {}).sort()) {
            if (!habit.forms.some((form) => form.id === id)) throw dataError("data.request.unknown-form", `Unknown form "${id}".`, `/${key}/${id.replaceAll("~", "~0").replaceAll("/", "~1")}`);
        }
    }
    const forms = applyOverrides(habit, request);
    return {
        crystallography: toCoreCrystallography(crystallography),
        morphology: {
            forms,
            ...(request.morphologyScale !== undefined ? { morphologyScale: request.morphologyScale } : {}),
        },
    };
}

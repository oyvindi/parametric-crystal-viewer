import type { Crystallography, Morphology } from "@crystal/core";
import type { Mineral, MineralCrystallography, HabitPreset, CrystalFormSetting } from "./types.js";

export interface MorphologyRequest {
    /** Habit preset to start from; defaults to the first habit. */
    readonly habitId?: string;
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
    if (habitId) {
        const habit = mineral.habits.find((h) => h.id === habitId);
        if (!habit) throw new Error(`Unknown habit "${habitId}" for mineral "${mineral.id}".`);
        return habit;
    }
    return mineral.habits[0]!;
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

/** Converts a mineral record and morphology request into core generator inputs. */
export function createCrystalInput(mineral: Mineral, request: MorphologyRequest = {}): CrystalInput {
    const habit = resolveHabit(mineral, request.habitId);
    const forms = applyOverrides(habit, request);
    return {
        crystallography: toCoreCrystallography(mineral.crystallography),
        morphology: {
            forms,
            ...(request.morphologyScale !== undefined ? { morphologyScale: request.morphologyScale } : {}),
        },
    };
}

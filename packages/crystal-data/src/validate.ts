import { validateCrystallography, validateMorphology, type Diagnostic, type Result } from "@crystal/core";
import type { Mineral, MineralCrystallography, Reference, CrystalFormSetting, SurfaceSelector } from "./types.js";
import { LUSTER_CATEGORIES } from "./types.js";
import { unwrapData, type DataDiagnosticCode } from "./diagnostics.js";
import { validatePreferredView } from "./preferred-view.js";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const validated = new WeakSet<object>();

/** Structural checks protect the typed scientific boundary from untrusted JSON. */
class RecordValidator {
    readonly diagnostics: Diagnostic[] = [];
    error(path: string, message: string, code: DataDiagnosticCode = "data.record.invalid-field"): void {
        this.diagnostics.push({ code, severity: "error", message, path });
    }
    record(value: unknown, path: string): value is ObjectValue {
        if (object(value)) return true;
        this.error(path, "Expected an object.");
        return false;
    }
    keys(value: ObjectValue, allowed: readonly string[], path: string): void {
        for (const key of Object.keys(value).sort()) if (!allowed.includes(key)) this.error(`${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, "Unsupported record field.");
    }
    string(value: unknown, path: string): void {
        if (!text(value)) this.error(path, "Expected a non-empty string.");
    }
    strings(value: unknown, path: string): void {
        if (!this.array(value, path)) return;
        value.forEach((item, i) => this.string(item, `${path}/${i}`));
    }
    number(value: unknown, path: string): void {
        if (typeof value !== "number" || !Number.isFinite(value)) this.error(path, "Expected a finite number.");
    }
    optionalStrings(value: ObjectValue, keys: readonly string[], path: string): void {
        for (const key of keys) if (value[key] !== undefined) this.string(value[key], `${path}/${key}`);
    }
    array(value: unknown, path: string, nonempty = true): value is unknown[] {
        if (!Array.isArray(value) || Array.from(value).some((entry) => entry === undefined) || (nonempty && value.length === 0)) {
            this.error(path, nonempty ? "Expected a non-empty array." : "Expected an array.");
            return false;
        }
        return true;
    }
    entries(value: unknown, path: string, visit: (entry: ObjectValue, path: string) => void, nonempty = true): void {
        if (!this.array(value, path, nonempty)) return;
        const ids = new Set<string>();
        value.forEach((item, i) => {
            const itemPath = `${path}/${i}`;
            if (!this.record(item, itemPath)) return;
            this.string(item.id, `${itemPath}/id`);
            if (text(item.id)) {
                if (ids.has(item.id)) this.error(`${itemPath}/id`, "IDs must be unique within their collection.", "data.record.duplicate-id");
                ids.add(item.id);
            }
            visit(item, itemPath);
        });
    }
    vector(value: unknown, path: string): void {
        if (!Array.isArray(value) || value.length !== 3) {
            this.error(path, "Expected a numeric triple.");
            return;
        }
        Array.from(value).forEach((v, i) => this.number(v, `${path}/${i}`));
    }
    crystallography(value: unknown, path: string): boolean {
        const before = this.diagnostics.length;
        if (!this.record(value, path)) return false;
        this.keys(value, ["crystalSystem", "setting", "pointGroup", "spaceGroup", "unitCell", "identityOnly", "pointOperations", "spaceOperations", "sourceLengthUnit"], path);
        this.string(value.crystalSystem, `${path}/crystalSystem`);
        this.optionalStrings(value, ["setting", "pointGroup", "spaceGroup"], path);
        if (value.identityOnly !== undefined && typeof value.identityOnly !== "boolean") this.error(`${path}/identityOnly`, "Expected a boolean.");
        for (const key of ["sourceLengthUnit"] as const) {
            if (value[key] !== undefined && value[key] !== "angstrom" && value[key] !== "nanometre") this.error(`${path}/${key}`, "Unsupported length unit.");
        }
        if (this.record(value.unitCell, `${path}/unitCell`)) {
            this.keys(value.unitCell, ["a", "b", "c", "alpha", "beta", "gamma", "lengthUnit"], `${path}/unitCell`);
            for (const key of ["a", "b", "c", "alpha", "beta", "gamma"]) this.number(value.unitCell[key], `${path}/unitCell/${key}`);
            if (value.unitCell.lengthUnit !== undefined && value.unitCell.lengthUnit !== "angstrom" && value.unitCell.lengthUnit !== "nanometre") this.error(`${path}/unitCell/lengthUnit`, "Unsupported length unit.");
        }
        for (const kind of ["pointOperations", "spaceOperations"] as const) {
            if (value[kind] === undefined) continue;
            this.entries(value[kind], `${path}/${kind}`, (op, opPath) => {
                this.keys(op, kind === "spaceOperations" ? ["id", "linear", "translation"] : ["id", "linear"], opPath);
                if (!Array.isArray(op.linear) || op.linear.length !== 3) this.error(`${opPath}/linear`, "Expected a 3 by 3 matrix.");
                else Array.from(op.linear).forEach((row, i) => this.vector(row, `${opPath}/linear/${i}`));
                if (kind === "spaceOperations") this.vector(op.translation, `${opPath}/translation`);
            });
        }
        return before === this.diagnostics.length;
    }
    references(value: unknown, path: string): void {
        this.entries(value, path, (reference, refPath) => {
            this.keys(reference, ["id", "title", "authors", "year", "doi", "url", "notes"], refPath);
            this.optionalStrings(reference, ["title", "doi", "url", "notes"], refPath);
            if (reference.authors !== undefined) this.strings(reference.authors, `${refPath}/authors`);
            if (reference.year !== undefined && !Number.isInteger(reference.year)) this.error(`${refPath}/year`, "Expected an integer year.");
        }, false);
    }
}

function freeze<T>(value: T): T {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

function normalizeCrystallography(c: MineralCrystallography): MineralCrystallography {
    if (c.unitCell.lengthUnit !== "nanometre") return c;
    return {
        ...c,
        sourceLengthUnit: "nanometre",
        unitCell: { ...c.unitCell, a: c.unitCell.a * 10, b: c.unitCell.b * 10, c: c.unitCell.c * 10, lengthUnit: "angstrom" },
    };
}

/** True when a dotted coverage path (including array wildcards) addresses existing data. */
function coversExisting(value: unknown, segments: readonly string[]): boolean {
    if (segments.length === 0) return value !== undefined;
    const [head, ...tail] = segments;
    if (head === "*") return Array.isArray(value) && value.length > 0 && value.some((v) => coversExisting(v, tail));
    if (Array.isArray(value) && /^\d+$/.test(head!)) return coversExisting(value[Number(head)], tail);
    return object(value) && Object.hasOwn(value, head!) && coversExisting(value[head!], tail);
}

function validateIndices(v: RecordValidator, value: unknown, path: string): value is SurfaceSelector {
    if (!v.record(value, path)) return false;
    const notation = value.notation;
    const allowed = notation === "miller-bravais" ? ["notation", "h", "k", "i", "l"] : ["notation", "h", "k", "l"];
    v.keys(value, allowed, path);
    if (notation !== "miller" && notation !== "miller-bravais") v.error(`${path}/notation`, "Expected Miller or Miller-Bravais notation.");
    for (const key of ["h", "k", "l"] as const) v.number(value[key], `${path}/${key}`);
    if (notation === "miller-bravais") v.number(value.i, `${path}/i`);
    return true;
}

function validateSurfaceSelector(v: RecordValidator, value: unknown, path: string): void {
    if (!v.record(value, path)) return;
    v.keys(value, ["formId", "family", "orientedIndices"], path);
    if (value.formId !== undefined) v.string(value.formId, `${path}/formId`);
    if (value.family !== undefined) validateIndices(v, value.family, `${path}/family`);
    if (value.orientedIndices !== undefined) validateIndices(v, value.orientedIndices, `${path}/orientedIndices`);
    if (value.formId === undefined && value.family === undefined && value.orientedIndices === undefined) v.error(path, "A surface selector needs a form ID or Miller selector.");
}

/** Validate, normalize and freeze a detached mineral snapshot. No geometry is required. */
export function validateMineral(value: unknown): Result<Mineral> {
    if (object(value) && validated.has(value)) return { ok: true, value: value as unknown as Mineral, diagnostics: [] };
    const v = new RecordValidator();
    if (!v.record(value, "")) return { ok: false, diagnostics: v.diagnostics };
    v.keys(value, ["id", "name", "formula", "dataRevision", "crystallography", "variants", "habits", "appearance", "surfaceProfiles", "references", "provenance"], "");
    for (const key of ["id", "name", "formula", "dataRevision"]) v.string(value[key], `/${key}`);
    const scientific: { value: MineralCrystallography; path: string }[] = [];
    if (v.crystallography(value.crystallography, "/crystallography")) scientific.push({ value: value.crystallography as unknown as MineralCrystallography, path: "/crystallography" });
    if (value.variants !== undefined) v.entries(value.variants, "/variants", (variant, path) => {
        v.keys(variant, ["id", "name", "description", "crystallography", "references"], path);
        v.string(variant.name, `${path}/name`);
        v.optionalStrings(variant, ["description"], path);
        if (v.crystallography(variant.crystallography, `${path}/crystallography`)) scientific.push({ value: variant.crystallography as unknown as MineralCrystallography, path: `${path}/crystallography` });
        if (variant.references !== undefined) v.references(variant.references, `${path}/references`);
    }, false);
    v.references(value.references, "/references");
    if (value.appearance !== undefined) v.entries(value.appearance, "/appearance", (ap, path) => {
        v.keys(ap, ["id", "name", "luster", "baseColor", "roughness", "metalness", "transmission", "ior", "absorptionColor", "absorptionDensity"], path);
        v.string(ap.name, `${path}/name`);
        if (ap.luster !== undefined) {
            if (typeof ap.luster !== "string" || !(LUSTER_CATEGORIES as readonly string[]).includes(ap.luster)) v.error(`${path}/luster`, "Unknown luster category.");
        }
        for (const key of ["baseColor", "absorptionColor"] as const) if (ap[key] !== undefined) v.string(ap[key], `${path}/${key}`);
        for (const key of ["roughness", "metalness", "transmission"] as const) {
            if (ap[key] !== undefined) {
                v.number(ap[key], `${path}/${key}`);
                if (typeof ap[key] === "number" && (ap[key] < 0 || ap[key] > 1)) v.error(`${path}/${key}`, "Expected a value in [0, 1].");
            }
        }
        if (ap.ior !== undefined) {
            v.number(ap.ior, `${path}/ior`);
            if (typeof ap.ior === "number" && ap.ior <= 0) v.error(`${path}/ior`, "IOR must be strictly positive.");
        }
        if (ap.absorptionDensity !== undefined) {
            v.number(ap.absorptionDensity, `${path}/absorptionDensity`);
            if (typeof ap.absorptionDensity === "number" && ap.absorptionDensity < 0) v.error(`${path}/absorptionDensity`, "Absorption density must be non-negative.");
        }
    });
    if (value.surfaceProfiles !== undefined) v.entries(value.surfaceProfiles, "/surfaceProfiles", (profile, path) => {
        v.keys(profile, ["id", "kind", "claimId", "surfaceOrigin", "selector", "direction", "description"], path);
        if (profile.kind !== "directional-striations" && profile.kind !== "pearly-luster") v.error(`${path}/kind`, "Unknown surface profile kind.");
        v.string(profile.claimId, `${path}/claimId`);
        if (profile.surfaceOrigin !== "growth-face") v.error(`${path}/surfaceOrigin`, "Only reviewed growth-face profiles are renderer-eligible.");
        v.string(profile.description, `${path}/description`);
        validateSurfaceSelector(v, profile.selector, `${path}/selector`);
        if (profile.kind === "directional-striations") {
            if (!v.record(profile.direction, `${path}/direction`)) return;
            v.keys(profile.direction, profile.direction.kind === "intersection-edge" ? ["kind", "otherFamily"] : ["kind", "axis"], `${path}/direction`);
            if (profile.direction.kind === "perpendicular-to-crystal-axis") {
                if (!["a", "b", "c"].includes(profile.direction.axis as string)) v.error(`${path}/direction/axis`, "Expected crystal axis a, b, or c.");
            } else if (profile.direction.kind === "intersection-edge") {
                validateIndices(v, profile.direction.otherFamily, `${path}/direction/otherFamily`);
            } else v.error(`${path}/direction/kind`, "Unknown surface direction.");
        } else if (profile.direction !== undefined) v.error(`${path}/direction`, "Pearly-luster profiles do not take a direction.");
    });
    const formLists: { forms: readonly CrystalFormSetting[]; path: string }[] = [];
    v.entries(value.habits, "/habits", (habit, path) => {
        v.keys(habit, ["id", "name", "description", "forms", "preferredView", "references"], path);
        v.string(habit.name, `${path}/name`);
        v.string(habit.description, `${path}/description`);
        const beforeForms = v.diagnostics.length;
        v.entries(habit.forms, `${path}/forms`, (form, formPath) => {
            v.keys(form, ["id", "label", "indices", "development", "enabled"], formPath);
            v.optionalStrings(form, ["label"], formPath);
            v.number(form.development, `${formPath}/development`);
            if (form.enabled !== undefined && typeof form.enabled !== "boolean") v.error(`${formPath}/enabled`, "Expected a boolean.");
            if (v.record(form.indices, `${formPath}/indices`)) {
                v.keys(form.indices, form.indices.notation === "miller-bravais" ? ["notation", "h", "k", "i", "l"] : ["notation", "h", "k", "l"], `${formPath}/indices`);
                v.string(form.indices.notation, `${formPath}/indices/notation`);
                for (const key of ["h", "k", "l"]) v.number(form.indices[key], `${formPath}/indices/${key}`);
                if (form.indices.notation === "miller-bravais") v.number(form.indices.i, `${formPath}/indices/i`);
            }
        });
        if (v.diagnostics.length === beforeForms) formLists.push({ forms: habit.forms as unknown as readonly CrystalFormSetting[], path });
        if (habit.preferredView !== undefined) {
            if (object(habit.preferredView)) v.keys(habit.preferredView, ["cameraDirection", "upDirection"], `${path}/preferredView`);
            v.diagnostics.push(...validatePreferredView(habit.preferredView, `${path}/preferredView`));
        }
        if (habit.references !== undefined) v.references(habit.references, `${path}/references`);
    });
    if (v.array(value.provenance, "/provenance")) value.provenance.forEach((entry, i) => {
        const path = `/provenance/${i}`;
        if (!v.record(entry, path)) return;
        v.keys(entry, ["coverage", "referenceIds", "status", "derivation"], path);
        v.strings(entry.coverage, `${path}/coverage`);
        if (!["reported", "derived", "curated", "estimated"].includes(entry.status as string)) v.error(`${path}/status`, "Unknown provenance status.", "data.record.invalid-provenance");
        if (entry.referenceIds !== undefined) v.strings(entry.referenceIds, `${path}/referenceIds`);
        v.optionalStrings(entry, ["derivation"], path);
        if (entry.status === "reported" && (!Array.isArray(entry.referenceIds) || !entry.referenceIds.length)) v.error(path, "Reported values require source references.", "data.record.invalid-provenance");
        if (entry.status !== "reported" && !text(entry.derivation)) v.error(`${path}/derivation`, "Curated/estimated values require an origin statement; derived values require a method.", "data.record.invalid-provenance");
        if (entry.status === "derived" && (!Array.isArray(entry.referenceIds) || !entry.referenceIds.length)) v.error(`${path}/referenceIds`, "Derived values require references to their inputs.", "data.record.invalid-provenance");
    });
    // Crystallographic checks are safe independently of malformed habits/metadata.
    for (const c of scientific) {
        const result = validateCrystallography(c.value);
        v.diagnostics.push(...result.diagnostics.map((d) => ({ ...d, path: d.path?.startsWith("/crystallography") ? c.path + d.path.slice(16) : c.path + (d.path ?? "") })));
    }
    for (const list of formLists) {
        const settings = scientific.length ? scientific.map((c) => c.value) : [undefined];
        for (const c of settings) v.diagnostics.push(...validateMorphology(list.forms, 1, c?.crystalSystem, c?.setting).map((d) => ({ ...d, path: list.path + (d.path ?? "") })));
    }
    if (v.diagnostics.some((d) => d.severity === "error")) return { ok: false, diagnostics: v.diagnostics };
    const mineral = value as unknown as Mineral;
    const references = new Map(mineral.references.map((r) => [r.id, r]));
    const traceable = (r: Reference) => Boolean(r.title || r.url || r.doi);
    for (const [i, reference] of mineral.references.entries()) if (!traceable(reference)) v.error(`/references/${i}`, "A source needs a title, URL, or DOI.", "data.record.invalid-reference");
    const checkReferences = (items: readonly Reference[] | undefined, path: string) => items?.forEach((r, i) => {
        if (!traceable(r) && !references.has(r.id)) v.error(`${path}/${i}/id`, "Unresolved source reference.", "data.record.invalid-reference");
    });
    mineral.habits.forEach((habit, i) => {
        checkReferences(habit.references, `/habits/${i}/references`);
    });
    mineral.variants?.forEach((variant, i) => checkReferences(variant.references, `/variants/${i}/references`));
    mineral.provenance.forEach((entry, i) => {
        entry.referenceIds?.forEach((id, j) => {
            if (!references.has(id)) v.error(`/provenance/${i}/referenceIds/${j}`, "Unresolved provenance source.", "data.record.invalid-provenance");
        });
        entry.coverage.forEach((coverage, j) => {
            if (!coversExisting(mineral, coverage.split("."))) v.error(`/provenance/${i}/coverage/${j}`, "Coverage does not address existing record fields.", "data.record.invalid-provenance");
        });
    });
    const covered = (path: string) => mineral.provenance.some((entry) => entry.coverage.some((coverage) => {
        const parts = path.split(".");
        const pattern = coverage.split(".");
        return pattern.length <= parts.length && pattern.every((part, i) => part === "*" || part === parts[i]);
    }));
    const requireCoverage = (path: string) => {
        if (!covered(path)) v.error("/" + path.replaceAll(".", "/"), "Scientific field needs provenance coverage.", "data.record.invalid-provenance");
    };
    for (const c of scientific) {
        const prefix = c.path.slice(1).replaceAll("/", ".");
        const leaves = (value: unknown, path: string): void => {
            if (Array.isArray(value)) value.forEach((child, i) => leaves(child, `${path}.${i}`));
            else if (object(value)) Object.entries(value).forEach(([key, child]) => { if (key !== "sourceLengthUnit" && child !== undefined) leaves(child, `${path}.${key}`); });
            else requireCoverage(path);
        };
        leaves(c.value, prefix);
    }
    mineral.habits.forEach((habit, i) => habit.forms.forEach((form, j) => {
        for (const key of Object.keys(form.indices)) requireCoverage(`habits.${i}.forms.${j}.indices.${key}`);
        for (const key of ["development", ...(form.enabled !== undefined ? ["enabled"] : [])]) requireCoverage(`habits.${i}.forms.${j}.${key}`);
    }));
    mineral.appearance?.forEach((preset, i) => {
        for (const key of ["luster", "baseColor", "roughness", "metalness", "transmission", "ior", "absorptionColor", "absorptionDensity"] as const) {
            if (preset[key] !== undefined) requireCoverage(`appearance.${i}.${key}`);
        }
    });
    mineral.surfaceProfiles?.forEach((profile, i) => {
        for (const key of ["kind", "claimId", "surfaceOrigin", "selector", "direction", "description"] as const) {
            if (profile[key] !== undefined) requireCoverage(`surfaceProfiles.${i}.${key}`);
        }
    });
    if (v.diagnostics.some((d) => d.severity === "error")) return { ok: false, diagnostics: v.diagnostics };
    // Select supported fields before cloning: extra caller metadata is not part of this schema.
    const snapshot: Mineral = structuredClone({
        id: mineral.id, name: mineral.name, formula: mineral.formula, dataRevision: mineral.dataRevision,
        crystallography: normalizeCrystallography(mineral.crystallography),
        habits: mineral.habits, references: mineral.references, provenance: mineral.provenance,
        ...(mineral.appearance ? { appearance: mineral.appearance } : {}),
        ...(mineral.surfaceProfiles ? { surfaceProfiles: mineral.surfaceProfiles } : {}),
        ...(mineral.variants ? { variants: mineral.variants.map((variant) => ({ ...variant, crystallography: normalizeCrystallography(variant.crystallography) })) } : {}),
    });
    freeze(snapshot);
    validated.add(snapshot);
    return { ok: true, value: snapshot, diagnostics: v.diagnostics };
}

/** Convenience for checked-in records; malformed data throws a typed error. */
export function defineMineral(value: unknown): Mineral {
    return unwrapData(validateMineral(value));
}

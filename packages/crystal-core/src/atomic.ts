import type { Diagnostic, Result } from "./diagnostics.js";
import type { Lattice, Mat3, Vec3 } from "./lattice.js";
import { applySpaceOperation, type SpaceOperation } from "./symmetry.js";

/**
 * Renderer-neutral atomic-structure types. Fractional coordinates are relative
 * to the enclosing phase unit cell. See [Atomic Structure](../../docs/data-model.md#atomic-structure).
 */

/** A single atomic site in the imported or curated structural definition. */
export interface AtomSite {
    readonly id: string;
    readonly element: string;
    readonly position: Vec3;
    readonly occupancy?: number;
    readonly label?: string;
}

export type SiteRepresentation = "asymmetric-unit" | "complete-cell";

export interface AtomicStructure {
    readonly siteRepresentation: SiteRepresentation;
    readonly sites: readonly AtomSite[];
    readonly bonds?: readonly PeriodicBond[];
}

/** An atom in the expanded reference cell, after symmetry expansion and dedup. */
export interface ExpandedAtom {
    /** Stable ID within this structural definition; bond endpoints refer to it. */
    readonly id: string;
    readonly sourceSiteId: string;
    readonly operationIds: readonly string[];
    readonly element: string;
    /** Wrapped fractional coordinates in `[0, 1)`. */
    readonly position: Vec3;
    readonly occupancy?: number;
    readonly label?: string;
}

export interface AtomImage {
    readonly siteId: string;
    readonly cellOffset: Vec3;
}

export interface PeriodicBond {
    readonly a: AtomImage;
    readonly b: AtomImage;
    readonly order?: number;
    /** True for distance-inferred bonds; omitted/false for imported bonds. */
    readonly derived?: boolean;
}

/**
 * Validates periodic bond endpoints against the expanded reference cell.
 * Imported or caller-supplied bonds must name expanded atom IDs and integer
 * lattice translations; renderers must never need to silently drop them.
 */
export function validatePeriodicBonds(bonds: unknown, atoms: readonly ExpandedAtom[]): Result<true> {
    const diagnostics: Diagnostic[] = [];
    if (!Array.isArray(bonds)) {
        return { ok: false, diagnostics: [{ code: "core.atomic.invalid-bond", severity: "error", message: "Bonds must be an array.", path: "/bonds" }] };
    }
    const atomIds = new Set(atoms.map((atom) => atom.id));
    const validImage = (image: unknown, path: string) => {
        if (!image || typeof image !== "object" || Array.isArray(image)) {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond endpoint must be an atom image.", path });
            return;
        }
        const value = image as Record<string, unknown>;
        if (typeof value.siteId !== "string" || !atomIds.has(value.siteId)) {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond endpoint must reference an expanded atom ID.", path: `${path}/siteId` });
        }
        if (!Array.isArray(value.cellOffset) || value.cellOffset.length !== 3 || !value.cellOffset.every((offset) => typeof offset === "number" && Number.isInteger(offset))) {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond cell offset must contain three integer lattice translations.", path: `${path}/cellOffset` });
        }
    };
    bonds.forEach((bond, index) => {
        const path = `/bonds/${index}`;
        if (!bond || typeof bond !== "object" || Array.isArray(bond)) {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond must be an object.", path });
            return;
        }
        const value = bond as Record<string, unknown>;
        validImage(value.a, `${path}/a`);
        validImage(value.b, `${path}/b`);
        if (value.order !== undefined && (typeof value.order !== "number" || !Number.isFinite(value.order) || value.order <= 0)) {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond order must be a positive finite number.", path: `${path}/order` });
        }
        if (value.derived !== undefined && typeof value.derived !== "boolean") {
            diagnostics.push({ code: "core.atomic.invalid-bond", severity: "error", message: "Bond derived flag must be a boolean.", path: `${path}/derived` });
        }
    });
    return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: true as const, diagnostics: [] };
}

/** Cartesian distance tolerance for merging symmetry-equivalent images (Å). */
export const ATOMIC_POSITION_TOLERANCE = 1e-4;

function diag(code: string, message: string, details?: Record<string, unknown>): Result<never> {
    const item: Diagnostic = { code, severity: "error", message, ...(details ? { details } : {}) };
    return { ok: false, diagnostics: [item] };
}

function cartesian(direct: Mat3, frac: Vec3): [number, number, number] {
    return [
        direct[0][0] * frac[0] + direct[0][1] * frac[1] + direct[0][2] * frac[2],
        direct[1][0] * frac[0] + direct[1][1] * frac[1] + direct[1][2] * frac[2],
        direct[2][0] * frac[0] + direct[2][1] * frac[1] + direct[2][2] * frac[2],
    ];
}

function metricDistanceSquared(metric: Mat3, delta: Vec3): number {
    const [x, y, z] = delta;
    return metric[0][0] * x * x + metric[1][1] * y * y + metric[2][2] * z * z
        + 2 * (metric[0][1] * x * y + metric[0][2] * x * z + metric[1][2] * y * z);
}

function wrap01(v: number): number {
    const r = v - Math.floor(v);
    return r >= 1 ? 0 : r < 0 ? 0 : r;
}

function wrap(position: Vec3): Vec3 {
    return [wrap01(position[0]), wrap01(position[1]), wrap01(position[2])];
}

function validateSites(sites: readonly AtomSite[]): Result<true> {
    const diagnostics: Diagnostic[] = [];
    const ids = new Set<string>();
    sites.forEach((site, i) => {
        const path = `/sites/${i}`;
        if (!site.id || ids.has(site.id)) diagnostics.push({ code: "core.atomic.invalid-site", severity: "error", message: "Site IDs must be non-empty and unique.", path: `${path}/id` });
        ids.add(site.id);
        if (!site.element || typeof site.element !== "string") diagnostics.push({ code: "core.atomic.invalid-site", severity: "error", message: "Site element symbol is required.", path: `${path}/element` });
        if (!site.position.every(Number.isFinite)) diagnostics.push({ code: "core.atomic.invalid-site", severity: "error", message: "Site positions must be finite fractional coordinates.", path: `${path}/position` });
        if (site.occupancy !== undefined && (!Number.isFinite(site.occupancy) || site.occupancy < 0 || site.occupancy > 1)) diagnostics.push({ code: "core.atomic.invalid-site", severity: "error", message: "Occupancy must be finite and within [0, 1].", path: `${path}/occupancy` });
    });
    return diagnostics.length ? { ok: false, diagnostics } : { ok: true, value: true as const, diagnostics: [] };
}

interface GeneratedImage {
    sourceSiteId: string;
    operationIds: string[];
    element: string;
    position: Vec3;
    occupancy?: number;
    label?: string;
}

/**
 * Expands atomic sites into the complete reference cell. Asymmetric-unit sites are
 * multiplied by the resolved space operations, wrapped into `[0, 1)`, and deduplicated
 * by source site and metric position. Complete-cell sites are wrapped only and are not
 * expanded a second time. Distinct source sites at the same position are never merged.
 */
export function expandAtomicStructure(
    structure: AtomicStructure,
    operations: readonly SpaceOperation[],
    lattice: Lattice,
): Result<readonly ExpandedAtom[]> {
    if (!structure.sites.length) return diag("core.atomic.empty-structure", "An atomic structure requires at least one site.");
    const siteCheck = validateSites(structure.sites);
    if (!siteCheck.ok) return siteCheck;
    const tol2 = ATOMIC_POSITION_TOLERANCE * ATOMIC_POSITION_TOLERANCE;

    const images: GeneratedImage[] = [];
    if (structure.siteRepresentation === "complete-cell") {
        for (const site of structure.sites) images.push({ sourceSiteId: site.id, operationIds: ["complete"], element: site.element, position: wrap(site.position), ...(site.occupancy !== undefined ? { occupancy: site.occupancy } : {}), ...(site.label ? { label: site.label } : {}) });
    } else {
        if (!operations.length) return diag("core.atomic.missing-operations", "Asymmetric-unit expansion requires resolved space operations.");
        const sorted = [...operations].sort((a, b) => a.id.localeCompare(b.id));
        for (const site of structure.sites) {
            for (const op of sorted) {
                const applied = applySpaceOperation(op, site.position);
                if (!applied.ok) return applied;
                images.push({ sourceSiteId: site.id, operationIds: [op.id], element: site.element, position: wrap(applied.value), ...(site.occupancy !== undefined ? { occupancy: site.occupancy } : {}), ...(site.label ? { label: site.label } : {}) });
            }
        }
    }

    // Merge equivalent periodic images of the SAME source site by metric position.
    const merged: GeneratedImage[] = [];
    for (const image of images) {
        const existing = merged.find((m) => m.sourceSiteId === image.sourceSiteId && metricDistanceSquared(lattice.metric, [m.position[0] - image.position[0], m.position[1] - image.position[1], m.position[2] - image.position[2]]) <= tol2);
        if (existing) {
            for (const id of image.operationIds) if (!existing.operationIds.includes(id)) existing.operationIds.push(id);
        } else merged.push({ ...image, operationIds: [...image.operationIds] });
    }

    // Deterministic stable IDs: sort by source site then wrapped position.
    merged.sort((a, b) => a.sourceSiteId.localeCompare(b.sourceSiteId) || a.position[0] - b.position[0] || a.position[1] - b.position[1] || a.position[2] - b.position[2]);
    const rankBySource = new Map<string, number>();
    const atoms: ExpandedAtom[] = merged.map((m) => {
        const rank = rankBySource.get(m.sourceSiteId) ?? 0;
        rankBySource.set(m.sourceSiteId, rank + 1);
        const id = structure.siteRepresentation === "complete-cell" ? m.sourceSiteId : `${m.sourceSiteId}:${rank}`;
        return { id, sourceSiteId: m.sourceSiteId, operationIds: Object.freeze(m.operationIds), element: m.element, position: Object.freeze(m.position) as unknown as Vec3, ...(m.occupancy !== undefined ? { occupancy: m.occupancy } : {}), ...(m.label ? { label: m.label } : {}) };
    });
    return { ok: true, value: Object.freeze(atoms), diagnostics: [] };
}

/** Covalent radii (Å) for common elements; unknown elements use the default. */
const COVALENT_RADIUS: Readonly<Record<string, number>> = Object.freeze({
    H: 0.31, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57,
    Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11, P: 1.07, S: 1.05, Cl: 1.02,
    K: 2.03, Ca: 1.76, Ti: 1.36, V: 1.25, Cr: 1.27, Mn: 1.39, Fe: 1.32,
    Co: 1.26, Ni: 1.24, Cu: 1.32, Zn: 1.22, Ga: 1.22, Ge: 1.20, As: 1.19,
    Se: 1.20, Br: 1.20, Rb: 2.20, Sr: 1.95, Zr: 1.54, Nb: 1.46, Mo: 1.45,
    Ag: 1.45, Cd: 1.44, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Ba: 2.15,
    W: 1.46, Au: 1.36, Hg: 1.32, Pb: 1.46, Bi: 1.48,
});
const DEFAULT_COVALENT_RADIUS = 1.5;

export interface BondInferenceOptions {
    /** Multiplier applied to the sum of covalent radii; defaults to 1.3. */
    readonly factor?: number;
    /** Minimum bond length (Å) to exclude coincident/self images; defaults to 0.1. */
    readonly minimum?: number;
}

/**
 * Infers periodic bonds from interatomic distances across the 27 neighbouring cells.
 * Every inferred bond is marked `derived: true`. Bonds are deduplicated so each
 * unordered pair appears once with the lexicographically smaller endpoint first.
 */
export function inferBonds(
    atoms: readonly ExpandedAtom[],
    lattice: Lattice,
    options: BondInferenceOptions = {},
): readonly PeriodicBond[] {
    const factor = options.factor ?? 1.3;
    const minimum = options.minimum ?? 0.1;
    const min2 = minimum * minimum;
    const bonds: PeriodicBond[] = [];
    const seen = new Set<string>();
    const offsets: Vec3[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) offsets.push([i, j, k]);
    for (let ai = 0; ai < atoms.length; ai++) {
        const a = atoms[ai]!;
        const ra = COVALENT_RADIUS[a.element] ?? DEFAULT_COVALENT_RADIUS;
        for (let bi = ai; bi < atoms.length; bi++) {
            const b = atoms[bi]!;
            const rb = COVALENT_RADIUS[b.element] ?? DEFAULT_COVALENT_RADIUS;
            const max2 = (factor * (ra + rb)) ** 2;
            for (const off of offsets) {
                if (ai === bi && off[0] === 0 && off[1] === 0 && off[2] === 0) continue;
                const delta = [b.position[0] + off[0] - a.position[0], b.position[1] + off[1] - a.position[1], b.position[2] + off[2] - a.position[2]] as const;
                const d2 = metricDistanceSquared(lattice.metric, delta);
                if (d2 < min2 || d2 > max2) continue;
                const imageA: AtomImage = { siteId: a.id, cellOffset: [0, 0, 0] };
                const imageB: AtomImage = { siteId: b.id, cellOffset: [off[0], off[1], off[2]] as unknown as Vec3 };
                const key = `${imageA.siteId}@0,0,0-${imageB.siteId}@${off[0]},${off[1]},${off[2]}`;
                const reverse = `${imageB.siteId}@${-off[0]},${-off[1]},${-off[2]}-${imageA.siteId}@0,0,0`;
                if (seen.has(key) || seen.has(reverse)) continue;
                seen.add(key);
                bonds.push({ a: imageA, b: imageB, derived: true });
            }
        }
    }
    return Object.freeze(bonds);
}

/** Converts a fractional position to Cartesian using the lattice direct basis. */
export function fractionalToCartesian(direct: Mat3, frac: Vec3): [number, number, number] {
    return cartesian(direct, frac);
}

export { cartesian as cartesianFromLattice };

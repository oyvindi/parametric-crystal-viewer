import type { CrystalFace, CrystalGeometry, FaceContributor, MillerIndices } from "@crystal/core";
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial } from "three";

export type SurfaceVec3 = readonly [number, number, number];

export interface SurfaceSelector {
    readonly formId?: string;
    /** Matches an unoriented, reduced Miller family (opposite signs are equivalent). */
    readonly family?: MillerIndices;
    /** Matches one reduced, oriented Miller index exactly. */
    readonly orientedIndices?: MillerIndices;
}

export interface SurfaceRule {
    readonly id: string;
    readonly profileId: number;
    readonly selector: SurfaceSelector;
    readonly priority?: number;
    /** Crystal-local Cartesian reference direction used to orient the face tangent. */
    readonly referenceDirection?: SurfaceVec3;
}

export interface FaceSurface {
    readonly faceIndex: number;
    readonly profileId: number;
    readonly ruleId?: string;
    readonly contributor?: FaceContributor;
    readonly tangent: SurfaceVec3;
    readonly bitangent: SurfaceVec3;
}

export interface FaceLocalGeometry {
    readonly buffer: BufferGeometry;
    readonly triangleFaces: Uint32Array;
    readonly faces: readonly FaceSurface[];
}

/** Diagnostic-only single material used to verify face profile routing in SR3. */
export function createSurfaceProfileTestMaterial(): ShaderMaterial {
    return new ShaderMaterial({
        vertexShader: `
            attribute float surfaceProfile;
            varying float vSurfaceProfile;
            void main() {
                vSurfaceProfile = surfaceProfile;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying float vSurfaceProfile;
            void main() {
                float p = vSurfaceProfile + 1.0;
                vec3 color = fract(vec3(p * 0.61803398875, p * 0.38196601125, p * 0.2360679775));
                gl_FragColor = vec4(color, 1.0);
            }
        `,
    });
}

/** Profile zero is the documented fallback for an unmatched or imported face. */
export const FALLBACK_SURFACE_PROFILE = 0;
/** Float attributes represent all integers exactly up to this supported limit. */
export const MAX_SURFACE_PROFILE_ID = 65_535;
/** SR3 uses position plus three face-local attributes: four vertex locations total. */
export const FACE_LOCAL_VERTEX_ATTRIBUTE_LOCATIONS = 4;

const EPSILON = 1e-10;
const dot = (a: SurfaceVec3, b: SurfaceVec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: SurfaceVec3, b: SurfaceVec3): SurfaceVec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const normalize = (v: SurfaceVec3): SurfaceVec3 | undefined => {
    const length = Math.hypot(...v);
    return length > EPSILON && Number.isFinite(length)
        ? [v[0] / length, v[1] / length, v[2] / length]
        : undefined;
};

function values(indices: MillerIndices): readonly number[] {
    return indices.notation === "miller"
        ? [indices.h, indices.k, indices.l]
        : [indices.h, indices.k, indices.i, indices.l];
}

function indexKey(indices: MillerIndices, family: boolean): string {
    let entries = [...values(indices)];
    if (family) {
        const first = entries.find((value) => value !== 0) ?? 0;
        if (first < 0) entries = entries.map((value) => -value);
    }
    return `${indices.notation}:${entries.join(",")}`;
}

function matches(selector: SurfaceSelector, contributor: FaceContributor): boolean {
    if (selector.formId !== undefined && selector.formId !== contributor.formId) return false;
    if (selector.family !== undefined && (!contributor.indices || indexKey(selector.family, true) !== indexKey(contributor.indices, true))) return false;
    if (selector.orientedIndices !== undefined && (!contributor.indices || indexKey(selector.orientedIndices, false) !== indexKey(contributor.indices, false))) return false;
    return selector.formId !== undefined || selector.family !== undefined || selector.orientedIndices !== undefined;
}

const specificity = (selector: SurfaceSelector): number =>
    Number(selector.formId !== undefined) + Number(selector.family !== undefined) + 2 * Number(selector.orientedIndices !== undefined);

/**
 * Resolves all tied contributors deterministically. Priority wins, followed by
 * selector specificity, rule ID, and contributor form ID. Input order is never
 * used as precedence.
 */
export function selectSurfaceRule(
    face: CrystalFace,
    rules: readonly SurfaceRule[],
): { readonly rule: SurfaceRule; readonly contributor: FaceContributor } | undefined {
    const candidates = rules.flatMap((rule) => face.contributors
        .filter((contributor) => matches(rule.selector, contributor))
        .map((contributor) => ({ rule, contributor })));
    candidates.sort((left, right) =>
        (right.rule.priority ?? 0) - (left.rule.priority ?? 0)
        || specificity(right.rule.selector) - specificity(left.rule.selector)
        || left.rule.id.localeCompare(right.rule.id)
        || left.contributor.formId.localeCompare(right.contributor.formId));
    return candidates[0];
}

/** Projects a crystal-local reference direction into a face, with a stable axis fallback. */
export function createFaceTangentFrame(normalInput: SurfaceVec3, reference: SurfaceVec3 = [1, 0, 0]): {
    readonly tangent: SurfaceVec3;
    readonly bitangent: SurfaceVec3;
} {
    const normal = normalize(normalInput);
    if (!normal) throw new RangeError("Face normal must be finite and non-zero.");
    const projected = (candidate: SurfaceVec3): SurfaceVec3 => {
        const amount = dot(candidate, normal);
        return [candidate[0] - amount * normal[0], candidate[1] - amount * normal[1], candidate[2] - amount * normal[2]];
    };
    let tangent = normalize(projected(reference));
    if (!tangent) {
        const axes: SurfaceVec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        axes.sort((a, b) => Math.abs(dot(a, normal)) - Math.abs(dot(b, normal)));
        tangent = normalize(projected(axes[0]!));
    }
    if (!tangent) throw new RangeError("Could not construct a face tangent.");
    const bitangent = normalize(cross(normal, tangent));
    if (!bitangent) throw new RangeError("Could not construct a face bitangent.");
    return { tangent, bitangent };
}

function validateRules(rules: readonly SurfaceRule[]): void {
    const ids = new Set<string>();
    for (const rule of rules) {
        if (!rule.id || ids.has(rule.id)) throw new RangeError("Surface rule IDs must be non-empty and unique.");
        ids.add(rule.id);
        if (!Number.isInteger(rule.profileId) || rule.profileId <= 0 || rule.profileId > MAX_SURFACE_PROFILE_ID) {
            throw new RangeError(`Surface profile IDs must be integers from 1 to ${MAX_SURFACE_PROFILE_ID}.`);
        }
        if (specificity(rule.selector) === 0) throw new RangeError("A surface rule must contain at least one selector.");
        if (rule.referenceDirection && !normalize(rule.referenceDirection)) throw new RangeError("Surface reference directions must be finite and non-zero.");
    }
}

/**
 * Builds the SR3 render buffer. Polygons are expanded per triangle because a
 * shared scientific vertex may need different face-local attributes on each face.
 * The returned triangleFaces array still maps each rendered triangle to its
 * original core face and complete contributor list.
 */
export function createFaceLocalGeometry(
    geometry: CrystalGeometry,
    rules: readonly SurfaceRule[] = [],
    defaultReferenceDirection: SurfaceVec3 = [1, 0, 0],
): FaceLocalGeometry {
    validateRules(rules);
    if (!normalize(defaultReferenceDirection)) throw new RangeError("Default surface reference direction must be finite and non-zero.");
    const positions: number[] = [], tangents: number[] = [], coordinates: number[] = [], profiles: number[] = [];
    const triangleFaces: number[] = [];
    const faces: FaceSurface[] = [];

    geometry.faces.forEach((face, faceIndex) => {
        const selected = selectSurfaceRule(face, rules);
        const frame = createFaceTangentFrame(face.normal, selected?.rule.referenceDirection ?? defaultReferenceDirection);
        const centroid: SurfaceVec3 = face.vertexIndices.reduce<readonly [number, number, number]>((sum, vertexIndex) => [
            sum[0] + geometry.vertices[vertexIndex * 3]!,
            sum[1] + geometry.vertices[vertexIndex * 3 + 1]!,
            sum[2] + geometry.vertices[vertexIndex * 3 + 2]!,
        ], [0, 0, 0]).map((value) => value / face.vertexIndices.length) as unknown as SurfaceVec3;
        const surface: FaceSurface = {
            faceIndex,
            profileId: selected?.rule.profileId ?? FALLBACK_SURFACE_PROFILE,
            ...(selected ? { ruleId: selected.rule.id, contributor: selected.contributor } : {}),
            ...frame,
        };
        faces.push(surface);
        for (let offset = 1; offset < face.vertexIndices.length - 1; offset++) {
            for (const vertexIndex of [face.vertexIndices[0]!, face.vertexIndices[offset]!, face.vertexIndices[offset + 1]!]) {
                const point: SurfaceVec3 = [geometry.vertices[vertexIndex * 3]!, geometry.vertices[vertexIndex * 3 + 1]!, geometry.vertices[vertexIndex * 3 + 2]!];
                const relative: SurfaceVec3 = [point[0] - centroid[0], point[1] - centroid[1], point[2] - centroid[2]];
                positions.push(...point);
                tangents.push(...frame.tangent);
                coordinates.push(dot(relative, frame.tangent), dot(relative, frame.bitangent));
                profiles.push(surface.profileId);
            }
            triangleFaces.push(faceIndex);
        }
    });

    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new Float32BufferAttribute(positions, 3));
    buffer.setAttribute("surfaceTangent", new Float32BufferAttribute(tangents, 3));
    buffer.setAttribute("surfaceCoord", new Float32BufferAttribute(coordinates, 2));
    buffer.setAttribute("surfaceProfile", new Float32BufferAttribute(profiles, 1));
    buffer.setIndex(Array.from({ length: positions.length / 3 }, (_, index) => index));
    return { buffer, triangleFaces: new Uint32Array(triangleFaces), faces };
}

/**
 * Re-resolves rules on an existing expanded render buffer. Position and index
 * buffers are retained, so profile changes do not regenerate scientific or
 * rendered geometry and picking triangle order remains stable.
 */
export function updateFaceLocalAttributes(
    buffer: BufferGeometry,
    geometry: CrystalGeometry,
    rules: readonly SurfaceRule[] = [],
    defaultReferenceDirection: SurfaceVec3 = [1, 0, 0],
): readonly FaceSurface[] {
    const resolved = createFaceLocalGeometry(geometry, rules, defaultReferenceDirection);
    const expected = buffer.getAttribute("position").count;
    if (resolved.buffer.getAttribute("position").count !== expected) {
        resolved.buffer.dispose();
        throw new RangeError("Existing render buffer does not match the supplied core geometry.");
    }
    for (const name of ["surfaceTangent", "surfaceCoord", "surfaceProfile"] as const) {
        buffer.setAttribute(name, resolved.buffer.getAttribute(name));
    }
    resolved.buffer.dispose();
    return resolved.faces;
}

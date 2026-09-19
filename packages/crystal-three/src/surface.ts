import { createLattice, type CrystalFace, type CrystalGeometry, type FaceContributor, type MillerIndices, type UnitCell } from "@crystal/core";
import { BufferGeometry, Float32BufferAttribute, MeshPhysicalMaterial, ShaderMaterial } from "three";

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
    readonly referenceDirection?: SurfaceVec3 | ((face: CrystalFace, contributor: FaceContributor) => SurfaceVec3);
}

/** Structural input accepted from data without making this renderer depend on crystal-data. */
export interface ReviewedSurfaceProfileInput {
    readonly id: string;
    readonly kind: "directional-striations" | "pearly-luster" | "growth-steps";
    readonly selector: SurfaceSelector;
}

/** Curated renderer IDs for the three SR5 profiles; none are scientific measurements. */
export const REVIEWED_SURFACE_PROFILE_IDS = {
    "quartz.m-prism-striations": 1,
    "calcite.0001-pearly": 2,
    "pyrite.100-cube-striations": 3,
    "fluorite.100-growth-steps": 4,
} as const;

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

export interface SurfaceDetailOptions {
    /** Artistic normal/roughness variation strength, constrained to [0, 1]. */
    readonly strength: number;
}

export interface SurfaceDetailUniforms {
    readonly surfaceDetailStrength: { value: number };
}

const SURFACE_DETAIL_UNIFORMS = "surfaceDetailUniforms";

/**
 * Maps only reviewed data profile IDs to renderer behavior. Shader constants
 * are curated visualization values; unknown profiles receive no inferred rule.
 */
export function createReviewedSurfaceRules(
    profiles: readonly ReviewedSurfaceProfileInput[] | undefined,
    unitCell: UnitCell,
): readonly SurfaceRule[] {
    if (!profiles?.length) return [];
    const lattice = createLattice(unitCell);
    if (!lattice.ok) return [];
    const axis = (index: 0 | 1 | 2): SurfaceVec3 => [lattice.value.direct[0][index], lattice.value.direct[1][index], lattice.value.direct[2][index]];
    return profiles.flatMap((profile): readonly SurfaceRule[] => {
        const profileId = REVIEWED_SURFACE_PROFILE_IDS[profile.id as keyof typeof REVIEWED_SURFACE_PROFILE_IDS];
        if (!profileId) return [];
        if (profile.id === "quartz.m-prism-striations" && profile.kind === "directional-striations") {
            return [{ id: profile.id, profileId, selector: profile.selector, referenceDirection: axis(2) }];
        }
        if (profile.id === "calcite.0001-pearly" && profile.kind === "pearly-luster") {
            return [{ id: profile.id, profileId, selector: profile.selector }];
        }
        if (profile.id === "pyrite.100-cube-striations" && profile.kind === "directional-striations") {
            return [{ id: profile.id, profileId, selector: profile.selector, referenceDirection: (face) => pyriteCubeIntersectionEdge(face.normal) }];
        }
        if (profile.id === "fluorite.100-growth-steps" && profile.kind === "growth-steps") {
            // The reviewed claim identifies the face family, not a step direction.
            // Tangent fallback remains deterministic but does not assert a documented direction.
            return [{ id: profile.id, profileId, selector: profile.selector }];
        }
        return [];
    });
}

/** Stable, platform-independent FNV-1a hash reduced to the exact Float32 integer range. */
export function stableSurfaceSeed(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash & 0x00ff_ffff;
}

function validateSurfaceDetailStrength(strength: number): void {
    if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
        throw new RangeError("Surface detail strength must be in [0, 1].");
    }
}

/**
 * Adds generic, object-locked microvariation and a restrained grazing-angle edge
 * response to one physical material. The effect only changes shader normals and
 * roughness; it never displaces vertices or changes the scientific silhouette.
 */
export function applySurfaceDetail(material: MeshPhysicalMaterial, options: SurfaceDetailOptions): void {
    validateSurfaceDetailStrength(options.strength);
    const uniforms: SurfaceDetailUniforms = {
        surfaceDetailStrength: { value: options.strength },
    };
    material.userData[SURFACE_DETAIL_UNIFORMS] = uniforms;
    material.onBeforeCompile = (shader) => {
        shader.uniforms["surfaceDetailStrength"] = uniforms.surfaceDetailStrength;
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute vec2 surfaceCoord;
attribute float surfaceSeed;
attribute float surfaceProfile;
varying vec2 vSurfaceCoord;
varying float vSurfaceSeed;
varying float vSurfaceProfile;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
vSurfaceCoord = surfaceCoord;
vSurfaceSeed = surfaceSeed;
vSurfaceProfile = surfaceProfile;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
uniform float surfaceDetailStrength;
varying vec2 vSurfaceCoord;
varying float vSurfaceSeed;
varying float vSurfaceProfile;
vec2 surfacePhase(float seed) {
    return vec2(fract(seed * 0.00000113), fract(seed * 0.00000179)) * 6.28318530718;
}
float surfaceWave(vec2 p, float seed) {
    vec2 phase = surfacePhase(seed);
    return 0.65 * sin(dot(p, vec2(13.1, 17.3)) + phase.x)
        + 0.35 * sin(dot(p, vec2(-21.7, 11.9)) + phase.y);
}
vec2 surfaceWaveGradient(vec2 p, float seed) {
    vec2 phase = surfacePhase(seed);
    float first = 0.65 * cos(dot(p, vec2(13.1, 17.3)) + phase.x);
    float second = 0.35 * cos(dot(p, vec2(-21.7, 11.9)) + phase.y);
    return first * vec2(13.1, 17.3) + second * vec2(-21.7, 11.9);
}
// SR5 values are curated visualization constants, not reported measurements.
float profileStripe(float coordinate, float frequency, float phase) {
    return sin(coordinate * frequency + phase);
}
// SR9 values are curated visualization constants, not reported step measurements.
float growthStepPhase(vec2 coordinate, float seed) {
    float phase = seed * 0.0000023;
    return coordinate.x * 14.0 + 0.65 * sin(coordinate.y * 5.0 + phase);
}
float growthStepSlope(vec2 coordinate, float seed) {
    float phase = growthStepPhase(coordinate, seed);
    float wave = sin(phase);
    return cos(phase) * pow(abs(wave), 3.0);
}
float hasSurfaceProfile(float id) {
    return 1.0 - step(0.25, abs(vSurfaceProfile - id));
}`)
            .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
vec3 q0 = dFdx(vViewPosition);
vec3 q1 = dFdy(vViewPosition);
vec2 st0 = dFdx(vSurfaceCoord);
vec2 st1 = dFdy(vSurfaceCoord);
vec3 tangent = normalize(q0 * st1.y - q1 * st0.y);
vec3 bitangent = normalize(-q0 * st1.x + q1 * st0.x);
if (surfaceDetailStrength > 0.0) {
    vec2 slope = surfaceWaveGradient(vSurfaceCoord, vSurfaceSeed);
    normal = normalize(normal + surfaceDetailStrength * 0.0012 * (slope.x * tangent + slope.y * bitangent));
}
float quartzStriation = hasSurfaceProfile(1.0);
float pyriteStriation = hasSurfaceProfile(3.0);
float fluoriteGrowthSteps = hasSurfaceProfile(4.0);
float quartzStripe = profileStripe(vSurfaceCoord.x, 18.0, vSurfaceSeed * 0.0000031);
float pyriteStripe = profileStripe(vSurfaceCoord.y, 15.0, vSurfaceSeed * 0.0000027);
float fluoriteStepSlope = growthStepSlope(vSurfaceCoord, vSurfaceSeed);
normal = normalize(normal
    + surfaceDetailStrength * quartzStriation * 0.012 * cos(vSurfaceCoord.x * 18.0 + vSurfaceSeed * 0.0000031) * tangent
    + surfaceDetailStrength * pyriteStriation * 0.010 * cos(vSurfaceCoord.y * 15.0 + vSurfaceSeed * 0.0000027) * bitangent
    + surfaceDetailStrength * fluoriteGrowthSteps * 0.120 * fluoriteStepSlope * (tangent + 0.42 * bitangent)
);`)
            .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
if (surfaceDetailStrength > 0.0) {
    float variation = surfaceWave(vSurfaceCoord, vSurfaceSeed);
    roughnessFactor = clamp(roughnessFactor + surfaceDetailStrength * 0.08 * variation, 0.04, 1.0);
}
roughnessFactor = clamp(roughnessFactor
    + surfaceDetailStrength * hasSurfaceProfile(1.0) * 0.10 * profileStripe(vSurfaceCoord.x, 18.0, vSurfaceSeed * 0.0000031)
    + surfaceDetailStrength * hasSurfaceProfile(3.0) * 0.08 * profileStripe(vSurfaceCoord.y, 15.0, vSurfaceSeed * 0.0000027)
    + surfaceDetailStrength * hasSurfaceProfile(4.0) * 0.24 * abs(growthStepSlope(vSurfaceCoord, vSurfaceSeed)),
    0.04, 1.0
);`)
            .replace("#include <opaque_fragment>", `#include <opaque_fragment>
if (surfaceDetailStrength > 0.0) {
    float grazing = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 5.0);
    outgoingLight += vec3(0.025 * surfaceDetailStrength * grazing);
}
// Curated face-local pearly contribution for reviewed calcite {0001} growth faces.
float pearly = hasSurfaceProfile(2.0);
float pearlyGrazing = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);
outgoingLight += surfaceDetailStrength * pearly * vec3(0.055, 0.052, 0.045) * pearlyGrazing;`);
    };
    material.customProgramCacheKey = () => "crystal-surface-detail-sr9-v2";
    material.needsUpdate = true;
}

/** Updates strength without recompilation; the material must already have SR4 detail. */
export function updateSurfaceDetailStrength(material: MeshPhysicalMaterial, strength: number): void {
    validateSurfaceDetailStrength(strength);
    const uniforms = material.userData[SURFACE_DETAIL_UNIFORMS] as SurfaceDetailUniforms | undefined;
    if (!uniforms) throw new RangeError("Surface detail has not been applied to this material.");
    uniforms.surfaceDetailStrength.value = strength;
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
/** SR4 uses position plus four face-local attributes: five vertex locations total. */
export const FACE_LOCAL_VERTEX_ATTRIBUTE_LOCATIONS = 5;

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

/**
 * Uses a cyclic, symmetry-equivalent {210} plane for an oriented cube face.
 * Its cross product with the cube normal is the documented intersection-edge
 * direction; the cyclic choice gives perpendicular directions on neighbours.
 */
function pyriteCubeIntersectionEdge(normalInput: SurfaceVec3): SurfaceVec3 {
    const normal = normalize(normalInput);
    if (!normal) throw new RangeError("Pyrite cube face normal must be finite and non-zero.");
    const absolute = [Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2])];
    const axis = absolute.indexOf(Math.max(...absolute));
    const sign = normal[axis]! >= 0 ? 1 : -1;
    const pyritohedronNormal: SurfaceVec3 = axis === 0 ? [2 * sign, 1, 0]
        : axis === 1 ? [0, 2 * sign, 1]
            : [1, 0, 2 * sign];
    const edge = normalize(cross(normal, pyritohedronNormal));
    if (!edge) throw new RangeError("Could not construct pyrite cube/pyritohedron intersection edge.");
    return edge;
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
        if (rule.referenceDirection && typeof rule.referenceDirection !== "function" && !normalize(rule.referenceDirection)) throw new RangeError("Surface reference directions must be finite and non-zero.");
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
    seedKey = "",
): FaceLocalGeometry {
    validateRules(rules);
    if (!normalize(defaultReferenceDirection)) throw new RangeError("Default surface reference direction must be finite and non-zero.");
    const positions: number[] = [], tangents: number[] = [], coordinates: number[] = [], profiles: number[] = [], seeds: number[] = [];
    const triangleFaces: number[] = [];
    const faces: FaceSurface[] = [];

    geometry.faces.forEach((face, faceIndex) => {
        const selected = selectSurfaceRule(face, rules);
        const reference = selected?.rule.referenceDirection;
        const resolvedReference = typeof reference === "function"
            ? reference(face, selected!.contributor)
            : reference ?? defaultReferenceDirection;
        const frame = createFaceTangentFrame(face.normal, resolvedReference);
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
        const contributorKey = [...face.contributors]
            .map((contributor) => `${contributor.formId}:${contributor.indices ? indexKey(contributor.indices, false) : "none"}`)
            .sort()
            .join("|");
        const faceSeed = stableSurfaceSeed(`${seedKey}|${faceIndex}|${contributorKey}`);
        for (let offset = 1; offset < face.vertexIndices.length - 1; offset++) {
            for (const vertexIndex of [face.vertexIndices[0]!, face.vertexIndices[offset]!, face.vertexIndices[offset + 1]!]) {
                const point: SurfaceVec3 = [geometry.vertices[vertexIndex * 3]!, geometry.vertices[vertexIndex * 3 + 1]!, geometry.vertices[vertexIndex * 3 + 2]!];
                const relative: SurfaceVec3 = [point[0] - centroid[0], point[1] - centroid[1], point[2] - centroid[2]];
                positions.push(...point);
                tangents.push(...frame.tangent);
                coordinates.push(dot(relative, frame.tangent), dot(relative, frame.bitangent));
                profiles.push(surface.profileId);
                seeds.push(faceSeed);
            }
            triangleFaces.push(faceIndex);
        }
    });

    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new Float32BufferAttribute(positions, 3));
    buffer.setAttribute("surfaceTangent", new Float32BufferAttribute(tangents, 3));
    buffer.setAttribute("surfaceCoord", new Float32BufferAttribute(coordinates, 2));
    buffer.setAttribute("surfaceProfile", new Float32BufferAttribute(profiles, 1));
    buffer.setAttribute("surfaceSeed", new Float32BufferAttribute(seeds, 1));
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
    seedKey = "",
): readonly FaceSurface[] {
    const resolved = createFaceLocalGeometry(geometry, rules, defaultReferenceDirection, seedKey);
    const expected = buffer.getAttribute("position").count;
    if (resolved.buffer.getAttribute("position").count !== expected) {
        resolved.buffer.dispose();
        throw new RangeError("Existing render buffer does not match the supplied core geometry.");
    }
    for (const name of ["surfaceTangent", "surfaceCoord", "surfaceProfile", "surfaceSeed"] as const) {
        buffer.setAttribute(name, resolved.buffer.getAttribute(name));
    }
    resolved.buffer.dispose();
    return resolved.faces;
}

import { describe, expect, it } from "vitest";
import { generateCrystal, generateCrystalFromFaces, type CrystalGeometry, type MillerIndices } from "@crystal/core";
import {
    FACE_LOCAL_VERTEX_ATTRIBUTE_LOCATIONS,
    FALLBACK_SURFACE_PROFILE,
    createFaceLocalGeometry,
    createFaceTangentFrame,
    createSurfaceProfileTestMaterial,
    selectSurfaceRule,
    updateFaceLocalAttributes,
    type SurfaceRule,
} from "./surface.js";

const cell = { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 };
const cube = (): CrystalGeometry => {
    const result = generateCrystal(
        { crystalSystem: "cubic", unitCell: cell, pointGroup: "m-3m", setting: "cubic-standard" },
        { forms: [
            { id: "cube", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 },
            { id: "tied", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 },
        ] },
    );
    if (result.status !== "valid") throw new Error("Expected cube");
    return result.geometry;
};

describe("SR3 deterministic surface selection", () => {
    it("uses priority, specificity, then stable IDs across tied contributors", () => {
        const face = cube().faces[0]!;
        const oriented = face.contributors.find((item) => item.formId === "cube")!.indices!;
        const rules: SurfaceRule[] = [
            { id: "z-form", profileId: 1, selector: { formId: "cube" } },
            { id: "b-specific", profileId: 2, selector: { formId: "cube", orientedIndices: oriented } },
            { id: "a-specific", profileId: 3, selector: { formId: "cube", orientedIndices: oriented } },
            { id: "priority", profileId: 4, priority: 1, selector: { formId: "tied" } },
        ];
        expect(selectSurfaceRule(face, rules)?.rule.id).toBe("priority");
        expect(selectSurfaceRule(face, rules.slice(0, 3).reverse())?.rule.id).toBe("a-specific");
    });

    it("distinguishes normalized families from oriented opposite faces", () => {
        const geometry = cube();
        const plus: MillerIndices = { notation: "miller", h: 1, k: 0, l: 0 };
        const rules: SurfaceRule[] = [
            { id: "family", profileId: 1, selector: { formId: "cube", family: plus } },
            { id: "positive", profileId: 2, selector: { formId: "cube", orientedIndices: plus } },
        ];
        const local = createFaceLocalGeometry(geometry, rules);
        expect(local.faces.filter((face) => face.profileId === 2)).toHaveLength(1);
        expect(local.faces.filter((face) => face.profileId === 1)).toHaveLength(1);
        expect(local.faces.filter((face) => face.profileId === 0)).toHaveLength(4);
    });
});

describe("SR3 face-local tangent and GPU encoding", () => {
    it("handles a reference parallel to the normal with an orthonormal fallback", () => {
        const frame = createFaceTangentFrame([1, 0, 0], [2, 0, 0]);
        expect(frame.tangent).toEqual([0, 1, 0]);
        expect(frame.bitangent).toEqual([0, 0, 1]);
    });

    it.each([
        ["cubic", [1, 0, 0], [1, 0, 0]],
        ["trigonal/hexagonal setting", [0.5, Math.sqrt(3) / 2, 0], [1, 0, 0]],
        ["monoclinic", [0.25, 0, 0.9682458366], [0, 1, 0]],
        ["triclinic", [0.3, 0.4, 0.8660254038], [1, 0.2, 0]],
    ] as const)("constructs a stable orthonormal frame for %s", (_name, normal, reference) => {
        const first = createFaceTangentFrame(normal, reference);
        const second = createFaceTangentFrame(normal, reference);
        expect(second).toEqual(first);
        expect(Math.hypot(...first.tangent)).toBeCloseTo(1, 12);
        expect(Math.hypot(...first.bitangent)).toBeCloseTo(1, 12);
        expect(first.tangent.reduce((sum, value, index) => sum + value * normal[index]!, 0)).toBeCloseTo(0, 10);
    });

    it("encodes one profile and seam-free local frame per polygon face", () => {
        const geometry = cube();
        const local = createFaceLocalGeometry(geometry, [{ id: "cube", profileId: 7, selector: { formId: "cube" } }]);
        expect(local.buffer.getAttribute("surfaceProfile").count).toBe(local.buffer.getAttribute("position").count);
        expect(local.buffer.getAttribute("surfaceTangent").itemSize).toBe(3);
        expect(local.buffer.getAttribute("surfaceCoord").itemSize).toBe(2);
        expect(FACE_LOCAL_VERTEX_ATTRIBUTE_LOCATIONS).toBe(5);
        expect(local.triangleFaces).toHaveLength(12);
        for (let triangle = 0; triangle < local.triangleFaces.length; triangle++) {
            const profile = local.buffer.getAttribute("surfaceProfile");
            expect([profile.getX(triangle * 3), profile.getX(triangle * 3 + 1), profile.getX(triangle * 3 + 2)]).toEqual([7, 7, 7]);
        }
        const material = createSurfaceProfileTestMaterial();
        expect(material.vertexShader).toContain("surfaceProfile");
        material.dispose();
    });

    it("changes selected form profiles without replacing geometry or picking order", () => {
        const geometry = cube();
        const local = createFaceLocalGeometry(geometry);
        const buffer = local.buffer;
        const position = buffer.getAttribute("position");
        const index = buffer.getIndex();
        const triangleFaces = local.triangleFaces.slice();
        const surfaces = updateFaceLocalAttributes(buffer, geometry, [
            { id: "selected", profileId: 9, selector: { formId: "cube" } },
        ]);
        expect(buffer).toBe(local.buffer);
        expect(buffer.getAttribute("position")).toBe(position);
        expect(buffer.getIndex()).toBe(index);
        expect(local.triangleFaces).toEqual(triangleFaces);
        expect(surfaces.every((face) => face.profileId === 9)).toBe(true);
    });

    it("does not mutate scientific vertices, faces, bounds, or contributors", () => {
        const geometry = cube();
        const vertices = new Uint8Array(geometry.vertices.buffer.slice(0));
        const faces = JSON.stringify(geometry.faces);
        const bounds = JSON.stringify(geometry.bounds);
        createFaceLocalGeometry(geometry, [{ id: "selected", profileId: 1, selector: { formId: "cube" } }]);
        expect(new Uint8Array(geometry.vertices.buffer)).toEqual(vertices);
        expect(JSON.stringify(geometry.faces)).toBe(faces);
        expect(JSON.stringify(geometry.bounds)).toBe(bounds);
    });
});

describe("SR3 fallback and picking provenance", () => {
    it("keeps original face mappings and complete tied contributors", () => {
        const geometry = cube();
        const local = createFaceLocalGeometry(geometry, [{ id: "selected", profileId: 1, selector: { formId: "cube" } }]);
        local.triangleFaces.forEach((faceIndex) => {
            expect(geometry.faces[faceIndex]!.contributors.map((item) => item.formId)).toEqual(["cube", "tied"]);
        });
    });

    it("uses fallback profile zero for imported measured faces without a matching rule", () => {
        const result = generateCrystalFromFaces(
            { crystalSystem: "cubic", unitCell: cell, pointGroup: "m-3m", setting: "cubic-standard" },
            [
                { id: "measured+x", h: 1, k: 0, l: 0, perpendicularDistance: 1 },
                { id: "measured-x", h: -1, k: 0, l: 0, perpendicularDistance: 1 },
                { id: "measured+y", h: 0, k: 1, l: 0, perpendicularDistance: 1 },
                { id: "measured-y", h: 0, k: -1, l: 0, perpendicularDistance: 1 },
                { id: "measured+z", h: 0, k: 0, l: 1, perpendicularDistance: 1 },
                { id: "measured-z", h: 0, k: 0, l: -1, perpendicularDistance: 1 },
            ],
        );
        if (result.status !== "valid") throw new Error("Expected measured cube");
        expect(createFaceLocalGeometry(result.geometry, [{ id: "curated-only", profileId: 1, selector: { formId: "cube" } }]).faces
            .every((face) => face.profileId === FALLBACK_SURFACE_PROFILE)).toBe(true);
    });

    it("rejects invalid rules before allocating a render buffer", () => {
        expect(() => createFaceLocalGeometry(cube(), [{ id: "bad", profileId: 0, selector: { formId: "cube" } }])).toThrow(RangeError);
        expect(() => createFaceLocalGeometry(cube(), [{ id: "bad", profileId: 1, selector: {} }])).toThrow(RangeError);
    });
});

import { describe, expect, it } from "vitest";
import { generateCrystal, type CrystalGeometry } from "@crystal/core";
import {
    applySurfaceDetail,
    createFaceLocalGeometry,
    createReviewedSurfaceRules,
    REVIEWED_SURFACE_PROFILE_IDS,
} from "./surface.js";
import { MeshPhysicalMaterial } from "three";

const quartzCell = { a: 4.913, b: 4.913, c: 5.405, alpha: 90, beta: 90, gamma: 120 };
const pyriteCell = { a: 5.4166, b: 5.4166, c: 5.4166, alpha: 90, beta: 90, gamma: 90 };

function valid(result: ReturnType<typeof generateCrystal>): CrystalGeometry {
    if (result.status !== "valid") throw new Error("Expected valid geometry");
    return result.geometry;
}

describe("SR5 reviewed surface profiles", () => {
    it("applies quartz striations only to prism m faces and uses c as the across-striae coordinate", () => {
        const geometry = valid(generateCrystal(
            { crystalSystem: "trigonal", unitCell: quartzCell, pointGroup: "32", setting: "hexagonal-standard" },
            { forms: [
                { id: "m", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 0 }, development: 1 },
                { id: "r", indices: { notation: "miller-bravais", h: 1, k: 0, i: -1, l: 1 }, development: 0.8 },
            ] },
        ));
        const rules = createReviewedSurfaceRules([{
            id: "quartz.m-prism-striations", kind: "directional-striations", selector: { formId: "m" },
        }], quartzCell);
        const local = createFaceLocalGeometry(geometry, rules);
        const matched = local.faces.filter((face) => face.profileId === REVIEWED_SURFACE_PROFILE_IDS["quartz.m-prism-striations"]);
        expect(matched.length).toBeGreaterThan(0);
        expect(local.faces.filter((face) => face.profileId !== 0 && face.profileId !== 1)).toHaveLength(0);
        for (const face of matched) {
            expect(Math.abs(face.tangent[2])).toBeGreaterThan(0.999999);
            expect(Math.abs(face.tangent[0] * geometry.faces[face.faceIndex]!.normal[0] + face.tangent[1] * geometry.faces[face.faceIndex]!.normal[1] + face.tangent[2] * geometry.faces[face.faceIndex]!.normal[2])).toBeLessThan(1e-10);
        }
        local.buffer.dispose();
    });

    it("keeps pyrite cube striations on {100} and gives adjoining cube faces perpendicular edge directions", () => {
        const geometry = valid(generateCrystal(
            { crystalSystem: "cubic", unitCell: pyriteCell, pointGroup: "m-3", setting: "cubic-standard" },
            { forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] },
        ));
        const rules = createReviewedSurfaceRules([{
            id: "pyrite.100-cube-striations", kind: "directional-striations", selector: { formId: "a" },
        }], pyriteCell);
        const local = createFaceLocalGeometry(geometry, rules);
        expect(local.faces.every((face) => face.profileId === REVIEWED_SURFACE_PROFILE_IDS["pyrite.100-cube-striations"])).toBe(true);
        const positiveX = local.faces.find((face) => geometry.faces[face.faceIndex]!.normal[0] > 0.99)!;
        const positiveY = local.faces.find((face) => geometry.faces[face.faceIndex]!.normal[1] > 0.99)!;
        expect(Math.abs(positiveX.tangent[0] * positiveY.tangent[0] + positiveX.tangent[1] * positiveY.tangent[1] + positiveX.tangent[2] * positiveY.tangent[2])).toBeLessThan(1e-10);
        local.buffer.dispose();
    });

    it("does not infer unreviewed profiles and injects profile-specific shader routing", () => {
        expect(createReviewedSurfaceRules([{ id: "future.unknown", kind: "directional-striations", selector: { formId: "x" } }], pyriteCell)).toEqual([]);
        const material = new MeshPhysicalMaterial();
        applySurfaceDetail(material, { strength: 0 });
        const shader = {
            uniforms: {} as Record<string, unknown>,
            vertexShader: "#include <common>\n#include <begin_vertex>",
            // Three.js emits roughness before normal maps; preserve that order so
            // this test catches cross-chunk local-variable dependencies.
            fragmentShader: "#include <common>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <opaque_fragment>",
        };
        material.onBeforeCompile(shader as never, null as never);
        expect(shader.vertexShader).toContain("surfaceProfile");
        expect(shader.fragmentShader).toContain("hasSurfaceProfile(2.0)");
        expect(shader.fragmentShader).toContain("quartzStriation");
        expect(shader.fragmentShader).toContain("pyriteStriation");
        const roughness = shader.fragmentShader.slice(shader.fragmentShader.indexOf("roughnessFactor = clamp(roughnessFactor"), shader.fragmentShader.indexOf("vec3 q0 = dFdx"));
        expect(roughness).toContain("profileStripe(vSurfaceCoord.x");
        expect(roughness).not.toContain("quartzStripe");
        material.dispose();
    });
});

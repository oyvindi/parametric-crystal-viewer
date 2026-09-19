import { describe, expect, it } from "vitest";
import { generateCrystal, type CrystalGeometry } from "@crystal/core";
import { MeshPhysicalMaterial } from "three";
import {
    applySurfaceDetail,
    createFaceLocalGeometry,
    stableSurfaceSeed,
    updateSurfaceDetailStrength,
} from "./surface.js";

const cube = (): CrystalGeometry => {
    const result = generateCrystal(
        { crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" },
        { forms: [{ id: "cube", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] },
    );
    if (result.status !== "valid") throw new Error("Expected cube");
    return result.geometry;
};

describe("SR4 deterministic generic surface detail", () => {
    it("produces stable exact Float32 seeds from state and face identity", () => {
        expect(stableSurfaceSeed("quartz|tessin|rock-crystal")).toBe(stableSurfaceSeed("quartz|tessin|rock-crystal"));
        expect(stableSurfaceSeed("quartz|tessin|rock-crystal")).not.toBe(stableSurfaceSeed("quartz|tessin|smoky"));
        expect(stableSurfaceSeed("quartz|tessin|rock-crystal")).toBeLessThanOrEqual(0x00ff_ffff);
    });

    it("keeps one seed and continuous local coordinates across triangles of a polygon", () => {
        const local = createFaceLocalGeometry(cube(), [], [1, 0, 0], "pyrite|cubic|brass");
        const seeds = local.buffer.getAttribute("surfaceSeed");
        const coordinates = local.buffer.getAttribute("surfaceCoord");
        for (let triangle = 0; triangle < local.triangleFaces.length; triangle++) {
            const first = triangle * 3;
            expect(seeds.getX(first + 1)).toBe(seeds.getX(first));
            expect(seeds.getX(first + 2)).toBe(seeds.getX(first));
        }
        const repeated = new Map<string, [number, number]>();
        const positions = local.buffer.getAttribute("position");
        for (let vertex = 0; vertex < positions.count; vertex++) {
            const key = `${positions.getX(vertex)},${positions.getY(vertex)},${positions.getZ(vertex)},${seeds.getX(vertex)}`;
            const coord: [number, number] = [coordinates.getX(vertex), coordinates.getY(vertex)];
            if (repeated.has(key)) expect(coord).toEqual(repeated.get(key));
            else repeated.set(key, coord);
        }
    });

    it("injects object-locked normal, roughness, and silhouette-safe edge response", () => {
        const material = new MeshPhysicalMaterial();
        applySurfaceDetail(material, { strength: 0 });
        const shader = {
            uniforms: {} as Record<string, unknown>,
            vertexShader: "#include <common>\n#include <begin_vertex>",
            fragmentShader: "#include <common>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>\n#include <opaque_fragment>",
        };
        material.onBeforeCompile(shader as never, null as never);
        expect(shader.vertexShader).toContain("surfaceCoord");
        expect(shader.fragmentShader).toContain("surfaceWave(vSurfaceCoord, vSurfaceSeed)");
        expect(shader.fragmentShader).not.toContain("gl_FragCoord");
        expect(shader.fragmentShader).toContain("grazing");
        updateSurfaceDetailStrength(material, 1);
        expect((shader.uniforms["surfaceDetailStrength"] as { value: number }).value).toBe(1);
        expect(() => updateSurfaceDetailStrength(material, 1.01)).toThrow(RangeError);
        material.dispose();
    });

    it("does not change scientific buffers or bounds", () => {
        const geometry = cube();
        const vertices = new Uint8Array(geometry.vertices.buffer.slice(0));
        const faces = JSON.stringify(geometry.faces);
        const bounds = JSON.stringify(geometry.bounds);
        createFaceLocalGeometry(geometry, [], [1, 0, 0], "stable-state");
        expect(new Uint8Array(geometry.vertices.buffer)).toEqual(vertices);
        expect(JSON.stringify(geometry.faces)).toBe(faces);
        expect(JSON.stringify(geometry.bounds)).toBe(bounds);
    });
});

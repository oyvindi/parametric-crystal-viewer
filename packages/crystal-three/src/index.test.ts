import { it, expect } from "vitest";
import { generateCrystal } from "@crystal/core";
import { triangulateCrystal, createThreeGeometry } from "./index.js";
it("maps every outward triangle to its crystallographic face and tied contributors", () => {
    const form = { id: "a", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 1 };
    const result = generateCrystal({ crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" }, { forms: [form, { ...form, id: "b" }] });
    if (result.status !== "valid") throw Error("Expected cube");
    const mesh = triangulateCrystal(result.geometry);
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.triangleFaces).toHaveLength(12);
    expect(triangulateCrystal(result.geometry)).toEqual(mesh);
    mesh.triangleFaces.forEach((faceIndex, i) => {
        const face = result.geometry.faces[faceIndex]!;
        expect(face.contributors.map((c) => c.formId)).toEqual(["a", "b"]);
        const triangle = [...mesh.indices.slice(i * 3, i * 3 + 3)];
        expect(triangle.every((v) => face.vertexIndices.includes(v))).toBe(true);
        const [a, b, c] = triangle.map((v) => result.geometry.vertices.slice(v * 3, v * 3 + 3));
        const ab = b!.map((x, j) => x - a![j]!); const ac = c!.map((x, j) => x - a![j]!);
        const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
        expect(cross.reduce((sum, x, j) => sum + x * face.normal[j]!, 0)).toBeGreaterThan(0);
    });
});
it("creates a Float32 BufferGeometry with correct index and position count", () => {
    const result = generateCrystal({ crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" }, { forms: [{ id: "cube", indices: { notation: "miller" as const, h: 1, k: 0, l: 0 }, development: 1 }] });
    if (result.status !== "valid") throw Error("Expected valid geometry");
    const geo = createThreeGeometry(result.geometry);
    expect(geo.getAttribute("position").array).toBeInstanceOf(Float32Array);
    expect(geo.getAttribute("position").count).toBe(8);
    expect(geo.getIndex()!.count).toBe(36);
    const normals = geo.getAttribute("normal");
    expect(normals).toBeDefined();
    expect(normals.array).toBeInstanceOf(Float32Array);
});
it("converts an octahedron to a valid BufferGeometry", () => {
    const result = generateCrystal({ crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" }, { forms: [{ id: "oct", indices: { notation: "miller" as const, h: 1, k: 1, l: 1 }, development: 1 }] });
    if (result.status !== "valid") throw Error("Expected valid octahedron");
    const geo = createThreeGeometry(result.geometry);
    expect(geo.getAttribute("position").count).toBe(6);
    expect(geo.getIndex()!.count).toBe(24);
});

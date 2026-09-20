import { expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import { createTerracedFluoriteDisplayGeometry, createThreeDisplayGrowthGeometry, validateWatertightDisplayComponent } from "./display-growth.js";

const bytes = (values: ArrayBufferView): number[] => [...new Uint8Array(values.buffer, values.byteOffset, values.byteLength)];

it("creates byte-identical, watertight stepped fluorite growth with core-face attribution", () => {
    const generated = generateCrystal(
        { crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" },
        { forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] },
    );
    if (generated.status !== "valid") throw new Error("Expected cube geometry.");
    const first = createTerracedFluoriteDisplayGeometry(generated.geometry, 0x1234_5678);
    const second = createTerracedFluoriteDisplayGeometry(generated.geometry, 0x1234_5678);
    expect(bytes(first.positions)).toEqual(bytes(second.positions));
    expect(bytes(first.triangleFaces)).toEqual(bytes(second.triangleFaces));
    expect(first.components.length).toBeGreaterThan(1);
    first.components.forEach((component) => expect(validateWatertightDisplayComponent(component)).toEqual({ ok: true }));
    expect(first.triangleFaces.length).toBeGreaterThan(12);
    first.triangleFaces.forEach((faceIndex) => expect(generated.geometry.faces[faceIndex]).toBeDefined());
    const buffer = createThreeDisplayGrowthGeometry(first);
    expect(buffer.getAttribute("position").count).toBe(first.positions.length / 3);
    expect(buffer.getIndex()!.count).toBe(first.positions.length / 3);
    buffer.dispose();
});

it("varies by seed without losing core attribution or leaving a source cube face", () => {
    const generated = generateCrystal(
        { crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" },
        { forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] },
    );
    if (generated.status !== "valid") throw new Error("Expected cube geometry.");
    const first = createTerracedFluoriteDisplayGeometry(generated.geometry, 1);
    const second = createTerracedFluoriteDisplayGeometry(generated.geometry, 2);
    expect(bytes(first.positions)).not.toEqual(bytes(second.positions));
    expect(first.triangleFaces).toEqual(second.triangleFaces);

    // Components after the core are attached child cubes. Project every vertex into
    // its attributed parent face and verify it remains within that face's square.
    for (const component of first.components.slice(1)) {
        const faceIndex = component.triangleFaces[0]!;
        expect([...component.triangleFaces].every((index) => index === faceIndex)).toBe(true);
        const face = generated.geometry.faces[faceIndex]!;
        const corners = face.vertexIndices.map((index) => [
            generated.geometry.vertices[index * 3]!,
            generated.geometry.vertices[index * 3 + 1]!,
            generated.geometry.vertices[index * 3 + 2]!,
        ] as const);
        const origin = corners[0]!;
        const u = corners[1]!.map((value, axis) => value - origin[axis]) as [number, number, number];
        const v = corners[3]!.map((value, axis) => value - origin[axis]) as [number, number, number];
        const uLengthSquared = u.reduce((sum, value) => sum + value * value, 0);
        const vLengthSquared = v.reduce((sum, value) => sum + value * value, 0);
        for (let i = 0; i < component.positions.length; i += 3) {
            const delta = [component.positions[i]! - origin[0], component.positions[i + 1]! - origin[1], component.positions[i + 2]! - origin[2]];
            const uFraction = delta.reduce((sum, value, axis) => sum + value * u[axis]!, 0) / uLengthSquared;
            const vFraction = delta.reduce((sum, value, axis) => sum + value * v[axis]!, 0) / vLengthSquared;
            expect(uFraction).toBeGreaterThanOrEqual(-1e-12);
            expect(uFraction).toBeLessThanOrEqual(1 + 1e-12);
            expect(vFraction).toBeGreaterThanOrEqual(-1e-12);
            expect(vFraction).toBeLessThanOrEqual(1 + 1e-12);
        }
    }
});

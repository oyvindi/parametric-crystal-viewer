import { expect, it } from "vitest";
import { generateCrystal } from "@crystal/core";
import { createTerracedFluoriteDisplayGeometry, createThreeDisplayGrowthGeometry, validateWatertightDisplayComponent } from "./display-growth.js";

it("creates deterministic, watertight fluorite hopper terraces with core-face attribution", () => {
    const generated = generateCrystal(
        { crystalSystem: "cubic", unitCell: { a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 }, pointGroup: "m-3m", setting: "cubic-standard" },
        { forms: [{ id: "a", indices: { notation: "miller", h: 1, k: 0, l: 0 }, development: 1 }] },
    );
    if (generated.status !== "valid") throw new Error("Expected cube geometry.");
    const first = createTerracedFluoriteDisplayGeometry(generated.geometry);
    const second = createTerracedFluoriteDisplayGeometry(generated.geometry);
    expect(first).toEqual(second);
    expect(first.components.length).toBeGreaterThan(1);
    first.components.forEach((component) => expect(validateWatertightDisplayComponent(component)).toEqual({ ok: true }));
    expect(first.triangleFaces.length).toBeGreaterThan(12);
    first.triangleFaces.forEach((faceIndex) => expect(generated.geometry.faces[faceIndex]).toBeDefined());
    const buffer = createThreeDisplayGrowthGeometry(first);
    expect(buffer.getAttribute("position").count).toBe(first.positions.length / 3);
    expect(buffer.getIndex()!.count).toBe(first.positions.length / 3);
    buffer.dispose();
});

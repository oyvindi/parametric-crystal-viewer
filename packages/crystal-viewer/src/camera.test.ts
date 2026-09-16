import { describe, expect, it } from "vitest";
import { createLattice, type Vec3 } from "@crystal/core";
import { FLUORITE, QUARTZ, MineralDataError } from "@crystal/data";
import { cameraBasis } from "./camera.js";

describe("preferred camera basis", () => {
    it("projects and normalizes the explicit up vector", () => {
        const basis = cameraBasis(QUARTZ.crystallography, { cameraDirection: [0, 0, 4], upDirection: [0, 3, 2] });
        expect(basis.direction).toEqual([0, 0, 1]);
        expect(basis.up).toEqual([0, 1, 0]);
    });

    it("uses the actual c lattice vector for a non-orthogonal cell", () => {
        const c = { ...QUARTZ.crystallography, unitCell: { a: 3, b: 4, c: 5, alpha: 75, beta: 80, gamma: 65 } };
        const lattice = createLattice(c.unitCell);
        if (!lattice.ok) throw Error("Invalid fixture");
        const cAxis = lattice.value.direct.map((row) => row[2]);
        const direction: Vec3 = [1, 0, 0];
        const basis = cameraBasis(c, { cameraDirection: direction });
        expect(basis.up[0]).toBeCloseTo(0);
        const length = Math.hypot(cAxis[1], cAxis[2]);
        expect(basis.up[1]).toBeCloseTo(cAxis[1] / length);
        expect(basis.up[2]).toBeCloseTo(cAxis[2] / length);
    });

    it("falls back from c to b deterministically when viewing along c", () => {
        const basis = cameraBasis(FLUORITE.crystallography, { cameraDirection: [0, 0, 1] });
        expect(basis.up[0]).toBeCloseTo(0);
        expect(basis.up[1]).toBeCloseTo(1);
        expect(basis.up[2]).toBeCloseTo(0);
        expect(cameraBasis(FLUORITE.crystallography, { cameraDirection: [0, 0, 1] })).toEqual(basis);
    });

    it("rejects parallel explicit up instead of silently substituting a fallback", () => {
        expect(() => cameraBasis(QUARTZ.crystallography, { cameraDirection: [0, 0, 1], upDirection: [0, 0, -1] })).toThrow(MineralDataError);
    });
});

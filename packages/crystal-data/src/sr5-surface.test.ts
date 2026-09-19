import { describe, expect, it } from "vitest";
import { CALCITE, PYRITE, QUARTZ, validateMineral } from "./index.js";

describe("SR5 reviewed surface-profile records", () => {
    it.each([
        [QUARTZ, "quartz.m-prism-striations", "surface.quartz.m-striation"],
        [CALCITE, "calcite.0001-pearly", "surface.calcite.0001-pearly"],
        [PYRITE, "pyrite.100-cube-striations", "surface.pyrite.100-striation"],
    ] as const)("keeps %s profile traceable and growth-face-only", (mineral, id, claimId) => {
        const profile = mineral.surfaceProfiles?.find((item) => item.id === id);
        expect(profile?.claimId).toBe(claimId);
        expect(profile?.surfaceOrigin).toBe("growth-face");
        expect(mineral.provenance.some((entry) => entry.coverage.includes("surfaceProfiles") && entry.status === "reported")).toBe(true);
        expect(validateMineral(mineral).ok).toBe(true);
    });

    it("does not encode calcite cleavage as an eligible renderer profile", () => {
        expect(CALCITE.surfaceProfiles?.every((profile) => profile.claimId !== "surface.calcite.cleavage-pearly")).toBe(true);
    });
});

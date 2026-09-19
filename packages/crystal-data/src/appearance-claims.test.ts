import { describe, expect, it } from "vitest";
import { ALBITE, ANATASE, BERYL, CALCITE, FLUORITE, FORSTERITE, GYPSUM, PYRITE, QUARTZ, validateMineral } from "./index.js";

describe("descriptive appearance claims", () => {
    it.each([
        [QUARTZ, "surface.quartz.m-striation"],
        [CALCITE, "surface.calcite.0001-pearly"],
        [CALCITE, "surface.calcite.cleavage-pearly"],
        [PYRITE, "surface.pyrite.100-striation"],
    ] as const)("keeps %s traceable without making it a renderer profile", (mineral, id) => {
        const claim = mineral.appearanceClaims?.find((item) => item.id === id);
        expect(claim).toBeDefined();
        expect(mineral.provenance.some((entry) => entry.coverage.some((coverage) => coverage === "appearanceClaims" || coverage.startsWith("appearanceClaims.")) && entry.status === "reported")).toBe(true);
        expect(validateMineral(mineral).ok).toBe(true);
    });

    it.each([ALBITE, ANATASE, BERYL, CALCITE, FLUORITE, FORSTERITE, GYPSUM, PYRITE, QUARTZ])("gives every shipped mineral a traceable appearance claim", (mineral) => {
        expect(mineral.appearanceClaims?.length).toBeGreaterThan(0);
        expect(mineral.provenance.some((entry) => entry.coverage.some((coverage) => coverage === "appearanceClaims" || coverage.startsWith("appearanceClaims.")) && entry.status === "reported")).toBe(true);
    });

    it("does not allow a cleavage claim to become renderer-eligible", () => {
        const candidate = structuredClone(CALCITE) as unknown as { appearanceClaims: Array<Record<string, unknown>> };
        const claim = candidate.appearanceClaims.find((item) => item.id === "surface.calcite.cleavage-pearly")!;
        claim.disposition = "renderer-eligible";
        claim.selector = { family: { notation: "miller-bravais", h: 0, k: 0, i: 0, l: 1 } };
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/appearanceClaims/1/surfaceOrigin")).toBe(true);
    });

    it("requires a reason when an observation is not renderer-eligible", () => {
        const candidate = structuredClone(CALCITE) as unknown as { appearanceClaims: Array<Record<string, unknown>> };
        delete candidate.appearanceClaims[1].dispositionReason;
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/appearanceClaims/1/dispositionReason")).toBe(true);
    });
});

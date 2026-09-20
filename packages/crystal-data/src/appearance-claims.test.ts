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

    it("keeps the fluorite {100} growth-step claim traceable through its reviewed profile", () => {
        const claim = FLUORITE.appearanceClaims?.find((item) => item.id === "surface.fluorite.100-growth-steps");
        expect(claim?.disposition).toBe("renderer-eligible");
        expect(FLUORITE.surfaceProfiles?.some((profile) => profile.claimId === claim?.id)).toBe(true);
    });

    it("records the locality-specific quartz z-face etching observation without promoting it", () => {
        const claim = QUARTZ.appearanceClaims?.find((item) => item.id === "surface.quartz.z-etching");
        expect(claim).toMatchObject({
            property: "etching",
            surfaceOrigin: "dissolution-or-etch",
            disposition: "candidate",
            selector: { formId: "z" },
        });
        expect(QUARTZ.surfaceProfiles?.some((profile) => profile.claimId === claim?.id)).toBe(false);
    });

    it("requires a reason when an observation is not renderer-eligible", () => {
        const candidate = structuredClone(CALCITE) as unknown as { appearanceClaims: Array<Record<string, unknown>> };
        delete candidate.appearanceClaims[1].dispositionReason;
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/appearanceClaims/1/dispositionReason")).toBe(true);
    });

    it("requires a renderer profile to promote its own eligible claim with the same selector", () => {
        const candidate = structuredClone(FLUORITE) as unknown as {
            appearanceClaims: Array<Record<string, unknown>>;
            surfaceProfiles: Array<Record<string, unknown>>;
        };
        candidate.surfaceProfiles[0].claimId = "appearance.fluorite.luster";
        candidate.surfaceProfiles[0].selector = { formId: "o" };
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/surfaceProfiles/0/claimId")).toBe(true);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/surfaceProfiles/0/selector")).toBe(true);
    });

    it("rejects a renderer-eligible claim that names no shipped form", () => {
        const candidate = structuredClone(FLUORITE) as unknown as { appearanceClaims: Array<Record<string, unknown>> };
        const claim = candidate.appearanceClaims.find((item) => item.id === "surface.fluorite.100-growth-steps")!;
        claim.selector = { formId: "not-a-fluorite-form" };
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/appearanceClaims/3/selector/formId")).toBe(true);
    });

    it("requires provenance coverage for every descriptive claim", () => {
        const candidate = structuredClone(ALBITE) as unknown as { provenance: Array<{ coverage: string[] }> };
        candidate.provenance = candidate.provenance.filter((entry) => !entry.coverage.some((coverage) => coverage.startsWith("appearanceClaims")));
        const result = validateMineral(candidate);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some((diagnostic) => diagnostic.path === "/appearanceClaims/0/id" && diagnostic.code === "data.record.invalid-provenance")).toBe(true);
    });

    it("accepts semantically identical promoted selectors regardless of JSON key order", () => {
        const candidate = structuredClone(CALCITE) as unknown as { surfaceProfiles: Array<Record<string, unknown>> };
        candidate.surfaceProfiles[0].selector = {
            family: { l: 1, i: 0, k: 0, notation: "miller-bravais", h: 0 },
        };
        expect(validateMineral(candidate).ok).toBe(true);
    });
});

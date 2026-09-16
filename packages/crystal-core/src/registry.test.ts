import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getPointOperationRegistryEntry } from "./index.js";
it("verifies committed registry integrity and prevents shared-operation mutation", () => {
    const entry = getPointOperationRegistryEntry("point-group:m-3m:standard")!;
    const artifact = readFileSync(new URL("./registry/cubic-operations.ts", import.meta.url));
    expect(createHash("sha256").update(artifact).digest("hex")).toBe(entry.integrity.artifactSha256);
    expect(entry.integrity.hallNumber).toBe(517);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.operations)).toBe(true);
    expect(entry.operations.every((op) => Object.isFrozen(op) && Object.isFrozen(op.linear) && op.linear.every(Object.isFrozen))).toBe(true);
});

import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getPointOperationRegistryEntry } from "./index.js";
it("verifies committed cubic registry integrity and prevents shared-operation mutation", () => {
    const entry = getPointOperationRegistryEntry("point-group:m-3m:standard")!;
    const artifact = readFileSync(new URL("./registry/cubic-operations.ts", import.meta.url));
    expect(createHash("sha256").update(artifact).digest("hex")).toBe(entry.integrity.artifactSha256);
    expect(entry.integrity.hallNumber).toBe(517);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.operations)).toBe(true);
    expect(entry.operations.every((op) => Object.isFrozen(op) && Object.isFrozen(op.linear) && op.linear.every(Object.isFrozen))).toBe(true);
});
it("verifies committed trigonal registry integrity and point-group 32 operations", () => {
    const entry = getPointOperationRegistryEntry("point-group:32:hexagonal")!;
    const artifact = readFileSync(new URL("./registry/trigonal-operations.ts", import.meta.url));
    expect(createHash("sha256").update(artifact).digest("hex")).toBe(entry.integrity.artifactSha256);
    expect(entry.integrity.hallNumber).toBe(441);
    expect(entry.integrity.spaceGroupNumber).toBe(152);
    expect(entry.pointGroup).toBe("32");
    expect(entry.operations).toHaveLength(6);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.operations)).toBe(true);
    expect(entry.operations.every((op) => Object.isFrozen(op) && Object.isFrozen(op.linear) && op.linear.every(Object.isFrozen))).toBe(true);
});

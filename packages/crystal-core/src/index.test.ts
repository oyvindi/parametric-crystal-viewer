import assert from "node:assert/strict";
import test from "node:test";

import { corePackage } from "./index.js";

test("crystal-core loads without browser globals", () => {
    assert.equal(corePackage, "@crystal/core");
    assert.equal(typeof globalThis.window, "undefined");
    assert.equal(typeof globalThis.document, "undefined");
});

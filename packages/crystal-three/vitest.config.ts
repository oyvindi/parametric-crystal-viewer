import { defineProject } from "vitest/config";
export default defineProject({ test: { name: "crystal-three", environment: "node", include: ["src/**/*.test.ts"] } });

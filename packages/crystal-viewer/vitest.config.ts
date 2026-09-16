import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "crystal-viewer",
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});

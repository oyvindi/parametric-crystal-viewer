import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "crystal-data",
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});

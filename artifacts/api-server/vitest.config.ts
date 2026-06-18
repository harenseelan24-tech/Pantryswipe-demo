import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    // Runs before each test file — sets env vars before any app module loads.
    setupFiles: ["./src/__tests__/setup.ts"],

    include: ["src/**/*.test.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Enforce minimum thresholds — CI fails if coverage drops below these.
      // Start conservative and tighten as the test suite grows.
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
      exclude: [
        "src/__tests__/**",
        "src/index.ts",   // entrypoint — tested via smoke test, not unit tests
      ],
    },
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{js,ts,tsx}"],
    // Load tests time large workloads, so they run on their own: npm run test:scale.
    exclude: ["**/node_modules/**", ...(mode === "scale" ? [] : ["tests/**/*-scale.integration.test.js"])],
    setupFiles: ["tests/setup.js"],
    // Integration suites each start an in-memory MongoDB in beforeAll; with suites running in
    // parallel that can take well over the 10 s default.
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.js"),
    },
  },
}));

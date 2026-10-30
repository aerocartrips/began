import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    setupFiles: ["./vitest.setup.ts"],
    environment: "jsdom",
    exclude: ["**/node_modules/**", "test/e2e/**", "dist/**"],
  },
});

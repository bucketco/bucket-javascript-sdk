import { defineConfig } from "vite";

export default defineConfig({
  test: {
    exclude: ["dist/**"],
    forceRerunTriggers: ["**/vitest.config.*/**", "**/vite.config.*/**"], // remove '**/package.json/**' from the default value to avoid rerun on test/gen/package.json changes
  },
});

/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    exclude: ["test/**", "dist/**"],
  },
});

import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],

  mode: env.mode,

  build: {
    lib: {
      entry: "src/index.ts",
      fileName: "bucket-tracking-sdk",
      name: "bucket",
      formats: ["es", "iife"],
    },
    rollupOptions: {
      external: ["cross-fetch"],
      output: {
        globals: {
          "cross-fetch": "fetch",
        },
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId?.endsWith("feedback/index.ts")) {
            return "bucket-tracking-feedback.mjs";
          }
          return "[name].[hash].js";
        },
      },
    },
  },

  test: {
    environment: "jsdom",
    exclude: [
      "test/e2e/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
  },
});

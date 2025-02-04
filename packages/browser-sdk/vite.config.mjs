import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
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
  plugins: [dts({ insertTypesEntry: true })],
  build: {
    exclude: ["**/node_modules/**", "test/e2e/**"],
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        configuredClient: resolve(__dirname, "src/configuredClient.ts"),
      },
      formats: ["es", "amd"],
      fileName: "bucket-browser-sdk-[name]",
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["_bucket"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          BucketClient: "BucketClient",
          _bucket: "_bucket",
        },
      },
    },
  },
});

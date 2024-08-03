import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  optimizeDeps: {
    include: ["@bucketco/browser-sdk"],
  },
  plugins: [vue(), dts({ insertTypesEntry: true })],
  build: {
    exclude: ["**/node_modules/**", "test/e2e/**"],
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "BucketVueSDK",
      fileName: "bucket-vue-sdk",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["vue"],
    },
  },
});

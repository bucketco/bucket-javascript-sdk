import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  optimizeDeps: {
    include: ["@bucketco/browser-sdk"],
  },
  plugins: [dts({ insertTypesEntry: true, exclude: ["dev"] })],
  build: {
    exclude: ["**/node_modules/**", "test/e2e/**", "dev"],
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "BucketReactSDK",
      fileName: "bucket-react-sdk",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});

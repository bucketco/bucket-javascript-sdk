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
  plugins: [dts({ insertTypesEntry: true })],
  build: {
    exclude: ["**/node_modules/**", "test/e2e/**"],
    sourcemap: true,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, "src/index.tsx"),
      name: "BucketReactSDK",
      // the proper extensions will be added
      fileName: "bucket-react-sdk",
      formats: ["es"],
    },
    rollupOptions: {
      //   // make sure to externalize deps that shouldn't be bundled
      //   // into your library

      external: ["react", "react-dom"],
      //   output: {
      //     // Provide global variables to use in the UMD build
      //     // for externalized deps
      //     globals: {
      //       BucketClient: "BucketClient",
      //     },
      //   },
    },
  },
});

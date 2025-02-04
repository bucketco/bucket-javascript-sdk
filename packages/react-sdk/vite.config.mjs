import { resolve } from "path";
import preserveDirectives from "rollup-preserve-directives";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  optimizeDeps: {
    include: ["@bucketco/browser-sdk"],
  },
  plugins: [
    dts({ insertTypesEntry: true, exclude: ["dev"] }),
    preserveDirectives(),
  ],
  build: {
    exclude: ["**/node_modules/**", "test/e2e/**", "dev"],
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.tsx"),
        baseBucketProvider: resolve(__dirname, "src/BaseBucketProvider.tsx"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "_bucket"],
      output: {
        globals: {
          react: "React",
          _bucket: "BucketInternal",
        },
      },
    },
  },
  server: {
    open: "/dev/plain/index.html",
  },
});

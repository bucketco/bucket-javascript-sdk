const path = require("path");
const { defineConfig } = require("vite");
import dts from "vite-plugin-dts";

module.exports = defineConfig({
  build: {
    lib: {
      name: "BucketTracking",
      entry: path.resolve(__dirname, "src/index.ts"),
      fileName: (format) =>
        `bucket-tracking.${format}.${format === "es" ? "m" : ""}js`,
    },
    rollupOptions: {
      output: {},
    },
  },
  plugins: [dts()],
});

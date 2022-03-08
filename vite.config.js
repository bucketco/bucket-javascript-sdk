const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  build: {
    lib: {
      name: "BucketTracking",
      entry: path.resolve(__dirname, "src/lib.ts"),
      fileName: (format) =>
        `bucket-tracking.${format}.${format === "es" ? "m" : ""}js`,
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ["vue"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        // globals: {
        //   vue: "Vue",
        // },
      },
    },
  },
});

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  optimizeDeps: {
    include: ["@bucketco/tracking-sdk"],
  },
  build: {
    build: {
      commonjsOptions: {
        include: [/tracking-sdk/, /node_modules/],
      },
    },
    lib: {
      entry: path.resolve(__dirname, "src", "ContextProvider"),
      name: "bucketco-react-sdk",
      fileName: (format) => `bucketco-react-sdk.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
        },
      },
    },
  },
  plugins: [react()],
});

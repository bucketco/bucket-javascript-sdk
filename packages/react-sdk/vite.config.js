import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  optimizeDeps: {
    include: ["@bucketco/tracking-sdk"],
  },
});

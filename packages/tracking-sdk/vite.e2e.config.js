import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["test/e2e/**/*.test.?(c|m)[jt]s?(x)"],
  },
});

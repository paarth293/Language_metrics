import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    pool: "threads",
    testTimeout: 30000,
    hookTimeout: 30000,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    pool: "threads",
    testTimeout: 30000,
    hookTimeout: 30000,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

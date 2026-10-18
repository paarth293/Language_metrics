import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Payment-security suite. Runs the real route handlers and settlement code
// against an in-memory database and a fake Cashfree sandbox (see harness/).
export default defineConfig({
  test: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
    include: ["tests/payment-security/**/*.test.ts"],
    environment: "node",
    alias: {
      "@": fileURLToPath(new URL("../../apps/student-web/src", import.meta.url)),
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only this package's own tests. Without an explicit include, running
    // vitest from the repo root would sweep in every app's suite too.
    include: ["src/**/*.test.ts"],
    environment: "node",
    // These are pure arithmetic tests over the cost model and the billing
    // interval maths — no database, no network, so they must stay fast.
    testTimeout: 10_000,
  },
});

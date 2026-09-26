import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only this package's own tests. Without an explicit include, running
    // vitest from the repo root would sweep in every app's suite too.
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The claim tests model the two SQL statements as in-memory transitions
    // and never open a database connection, so they must stay fast.
    testTimeout: 10_000,
  },
});

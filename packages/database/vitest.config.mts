import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The ledger invariant tests model the SQL in coin-ledger.ts as in-memory
    // transitions; they never open a database connection.
    include: ["*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
});

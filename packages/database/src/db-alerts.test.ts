import { beforeEach, describe, expect, it, vi } from "vitest";

// #8e: the database being down (unreachable, pool exhausted, connections
// refused) raises an ops alert. An ordinary failed query does not.
const alerts = vi.hoisted(() => ({ reportOpsAlert: vi.fn(async () => {}) }));
vi.mock("@repo/logger/ops-alert", () => alerts);

beforeEach(() => {
  alerts.reportOpsAlert.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("onPrismaError (#8e)", () => {
  it.each([
    "Can't reach database server at `db.example.test:5432`",
    "Timed out fetching a new connection from the connection pool. (P2024)",
    "Error querying the database: FATAL: remaining connection slots are reserved",
    "Server has closed the connection.",
  ])("alerts on %s", async (message) => {
    const { onPrismaError } = await import("./db-alerts");
    onPrismaError({ message, target: "quaint::connector" });
    expect(alerts.reportOpsAlert).toHaveBeenCalledWith("db_error", expect.objectContaining({ scope: "prisma" }));
  });

  it.each([
    "Unique constraint failed on the fields: (`email`)",
    "Record to update not found.",
  ])("only logs %s", async (message) => {
    const { onPrismaError } = await import("./db-alerts");
    onPrismaError({ message, target: "" });
    expect(alerts.reportOpsAlert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"msg":"[prisma]"'));
  });
});

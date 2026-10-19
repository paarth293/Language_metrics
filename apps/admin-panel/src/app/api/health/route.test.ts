// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// #8f: an uptime monitor can tell whether admin-panel's dependencies are up,
// without the answer leaking anything about them.
const deps = vi.hoisted(() => ({ query: vi.fn(), ping: vi.fn() }));
vi.mock("@repo/database", () => ({ db: { $queryRaw: deps.query } }));
vi.mock("@/lib/redis-session", () => ({ pingSessionStore: deps.ping }));

beforeEach(() => {
  deps.query.mockReset().mockResolvedValue([{ "?column?": 1 }]);
  deps.ping.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("GET /api/health (admin-panel, #8f)", () => {
  it("answers 200 when the database and Redis are up", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", services: { database: "up", redis: "up" } });
  });

  it("answers 503 without the error text when the database is down", async () => {
    deps.query.mockRejectedValue(new Error("Can't reach database server at db.internal:5432 (postgresql://app:pw@db.internal)"));
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: "degraded", services: { database: "down", redis: "up" } });
    expect(text).not.toMatch(/db\.internal|postgresql|reach/);
  });

  it("answers 503 when Redis is down", async () => {
    deps.ping.mockResolvedValue(false);
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded", services: { database: "up", redis: "down" } });
  });

  it("treats a database that never answers as down", async () => {
    vi.useFakeTimers();
    deps.query.mockReturnValue(new Promise(() => {}));
    const { GET } = await import("./route");
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3_000);
    expect((await pending).status).toBe(503);
    vi.useRealTimers();
  });
});

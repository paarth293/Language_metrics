// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// pingSessionStore backs /api/health (#8f): true only on PONG, false (never a
// throw) when Redis errors or hangs.
const redis = vi.hoisted(() => ({ ping: vi.fn() }));
vi.mock("ioredis", () => ({
  default: class {
    ping = redis.ping;
    on() { return this; }
  },
}));

beforeEach(() => {
  vi.resetModules();
  redis.ping.mockReset();
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("pingSessionStore", () => {
  it("is true when Redis answers PONG", async () => {
    redis.ping.mockResolvedValue("PONG");
    const { pingSessionStore } = await import("./redis-session");
    expect(await pingSessionStore(2_000)).toBe(true);
  });

  it("is false when Redis errors", async () => {
    redis.ping.mockRejectedValue(new Error("Connection is closed."));
    const { pingSessionStore } = await import("./redis-session");
    expect(await pingSessionStore(2_000)).toBe(false);
  });

  it("is false when Redis never answers", async () => {
    redis.ping.mockReturnValue(new Promise(() => {}));
    const { pingSessionStore } = await import("./redis-session");
    expect(await pingSessionStore(50)).toBe(false);
  });

  it("is false when REDIS_URL is not set", async () => {
    vi.stubEnv("REDIS_URL", "");
    const { pingSessionStore } = await import("./redis-session");
    expect(await pingSessionStore(2_000)).toBe(false);
  });
});

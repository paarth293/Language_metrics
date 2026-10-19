import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// A Redis whose SET fails while `redis.down` is true, then recovers.
// `startStatus` "wait" models a fresh lazyConnect client on a cold start.
const redis = vi.hoisted(() => ({ down: true, setCalls: 0, startStatus: "ready" }));

vi.mock("ioredis", () => {
  class FlakyRedis {
    status = redis.startStatus;
    on() {
      return this;
    }
    async connect() {
      // Like ioredis: a second connect() while one is in flight throws.
      if (this.status !== "wait") throw new Error("Redis is already connecting/connected");
      this.status = "connecting";
      await new Promise((resolve) => setTimeout(resolve, 5));
      this.status = "ready";
    }
    async set() {
      redis.setCalls += 1;
      if (redis.down) throw new Error("Connection is closed.");
      return "OK";
    }
  }
  return { default: FlakyRedis };
});

describe("refresh session store when Redis fails", () => {
  beforeEach(() => {
    vi.resetModules();
    redis.down = true;
    redis.setCalls = 0;
    redis.startStatus = "ready";
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("in production, refuses to store sessions in instance memory and goes back to Redis once it recovers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { storeRefreshSession } = await import("./redis-session");

    await expect(storeRefreshSession("user-1", "session-1")).rejects.toThrow(/session store unavailable/i);

    redis.down = false;
    await expect(storeRefreshSession("user-1", "session-2")).resolves.toBeUndefined();
    expect(redis.setCalls).toBe(2);
  });

  it("in production, concurrent first calls on a cold start both reach Redis", async () => {
    vi.stubEnv("NODE_ENV", "production");
    redis.down = false;
    redis.startStatus = "wait";
    const { storeRefreshSession } = await import("./redis-session");

    await expect(
      Promise.all([storeRefreshSession("user-1", "session-1"), storeRefreshSession("user-2", "session-2")])
    ).resolves.toEqual([undefined, undefined]);
    expect(redis.setCalls).toBe(2);
  });

  it("in development, still falls back to the in-memory store", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { storeRefreshSession, verifyRefreshSession } = await import("./redis-session");

    await expect(storeRefreshSession("user-1", "session-1")).resolves.toBeUndefined();
    expect(await verifyRefreshSession("user-1", "session-1")).toMatchObject({ userId: "user-1" });
  });
});

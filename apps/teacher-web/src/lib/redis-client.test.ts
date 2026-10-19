import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `redis.connectFails` makes the initial connect() reject, as on a cold
// start while Upstash is briefly unreachable.
const redis = vi.hoisted(() => ({ connectFails: false }));

vi.mock("ioredis", () => {
  class FakeRedis {
    status = "wait";
    on() {
      return this;
    }
    async connect() {
      if (redis.connectFails) throw new Error("connect ETIMEDOUT");
      this.status = "ready";
    }
    async ping() {
      return "PONG";
    }
    disconnect() {}
  }
  return { default: FakeRedis };
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("getRedisClient", () => {
  beforeEach(() => {
    vi.resetModules();
    redis.connectFails = false;
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("in production, returns a client on the very first call of a cold start", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getRedisClient } = await import("./redis-client");

    expect(getRedisClient()).not.toBeNull();
  });

  it("in production, keeps returning the client after a failed connect so it can reconnect", async () => {
    vi.stubEnv("NODE_ENV", "production");
    redis.connectFails = true;
    const { getRedisClient } = await import("./redis-client");

    getRedisClient();
    await flush();
    expect(getRedisClient()).not.toBeNull();
  });

  it("in development, still returns null until the connection is confirmed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getRedisClient } = await import("./redis-client");

    expect(getRedisClient()).toBeNull();
    await flush();
    expect(getRedisClient()).not.toBeNull();
  });
});

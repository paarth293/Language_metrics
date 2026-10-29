import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Counts every ioredis client the limiter creates. The pipeline reports a
// window count of 1, so every call is allowed.
const created = vi.hoisted(() => ({ count: 0 }));

vi.mock("ioredis", () => {
  class FakeRedis {
    status = "ready";
    constructor() {
      created.count += 1;
    }
    on() {
      return this;
    }
    async connect() {}
    async quit() {}
    pipeline() {
      const chain = {
        zremrangebyscore: () => chain,
        zadd: () => chain,
        zcard: () => chain,
        pexpire: () => chain,
        exec: async () => [[null, 0], [null, 1], [null, 1], [null, 1]],
      };
      return chain;
    }
  }
  return { default: FakeRedis };
});

describe("rateLimitRedis connection reuse", () => {
  beforeEach(() => {
    vi.resetModules();
    created.count = 0;
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates one Redis client for many calls instead of one per call", async () => {
    const { rateLimitRedis } = await import("./rate-limit");

    for (let i = 0; i < 5; i++) {
      expect(await rateLimitRedis(`ip-${i}`, "login", { windowMs: 60_000, max: 10 })).toBe(false);
    }

    expect(created.count).toBe(1);
  });
});

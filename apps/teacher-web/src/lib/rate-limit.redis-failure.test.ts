import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Every Redis pipeline fails, as it would while Upstash is unreachable.
vi.mock("ioredis", () => {
  class FailingRedis {
    status = "ready";
    on() {
      return this;
    }
    pipeline() {
      const chain = {
        zremrangebyscore: () => chain,
        zadd: () => chain,
        zcard: () => chain,
        pexpire: () => chain,
        exec: async () => {
          throw new Error("Connection is closed.");
        },
      };
      return chain;
    }
  }
  return { default: FailingRedis };
});

describe("rateLimitRedis when Redis is failing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("still enforces the limit with the in-process fallback instead of allowing everything", async () => {
    const { rateLimitRedis } = await import("./rate-limit");
    const opts = { windowMs: 60_000, max: 2 };

    expect(await rateLimitRedis("1.2.3.4", "login", opts)).toBe(false); // 1
    expect(await rateLimitRedis("1.2.3.4", "login", opts)).toBe(false); // 2
    expect(await rateLimitRedis("1.2.3.4", "login", opts)).toBe(true);  // 3 → blocked
  });
});

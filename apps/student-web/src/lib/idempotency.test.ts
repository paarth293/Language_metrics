import { beforeEach, describe, expect, it, vi } from "vitest";

// #38: SETNX followed by EXPIRE is two round trips. A crash between them
// leaves a key with no TTL, so that idempotency key is blocked forever.
type Command = { name: string; args: unknown[] };

const redis = vi.hoisted(() => ({
  commands: [] as Command[],
  store: new Map<string, string>(),
  client: null as Record<string, unknown> | null,
}));

vi.mock("./redis-client", () => ({
  getRedisClient: () => redis.client,
}));

function fakeRedis() {
  const record = (name: string) => async (...args: unknown[]) => {
    redis.commands.push({ name, args });
    if (name === "set") {
      const [key, value, ...rest] = args as [string, string, ...string[]];
      const nx = rest.some((o) => String(o).toUpperCase() === "NX");
      if (nx && redis.store.has(key)) return null;
      redis.store.set(key, value);
      return "OK";
    }
    if (name === "setnx") {
      const [key, value] = args as [string, string];
      if (redis.store.has(key)) return 0;
      redis.store.set(key, value);
      return 1;
    }
    return 1;
  };
  return { set: record("set"), setnx: record("setnx"), expire: record("expire") };
}

beforeEach(() => {
  vi.resetModules();
  redis.commands = [];
  redis.store = new Map();
  redis.client = fakeRedis();
});

const SEVEN_DAYS = 60 * 60 * 24 * 7;

describe("checkAndSetIdempotency (#38)", () => {
  it("claims a key and its TTL in one atomic SET with EX and NX", async () => {
    const { checkAndSetIdempotency } = await import("./idempotency");
    expect(await checkAndSetIdempotency("order-1")).toBe(true);

    // Argument order is ioredis's typed overload; Redis treats EX/NX as flags.
    expect(redis.commands).toEqual([
      { name: "set", args: ["idempotency:order-1", "1", "EX", SEVEN_DAYS, "NX"] },
    ]);
    // No separate EXPIRE: a crash can't leave a key without a TTL.
    expect(redis.commands.some((c) => c.name === "expire" || c.name === "setnx")).toBe(false);
  });

  it("reports a key that was already claimed", async () => {
    const { checkAndSetIdempotency } = await import("./idempotency");
    expect(await checkAndSetIdempotency("order-1")).toBe(true);
    expect(await checkAndSetIdempotency("order-1")).toBe(false);
    expect(redis.commands.filter((c) => c.name === "set")).toHaveLength(2);
  });

  it("keeps separate keys apart", async () => {
    const { checkAndSetIdempotency } = await import("./idempotency");
    expect(await checkAndSetIdempotency("order-1")).toBe(true);
    expect(await checkAndSetIdempotency("order-2")).toBe(true);
  });

  it("fails open without Redis, and says so through the logger", async () => {
    const warn = vi.fn();
    vi.doMock("@repo/logger", () => ({ log: { warn, error: vi.fn(), info: vi.fn() } }));
    redis.client = null;
    const { checkAndSetIdempotency } = await import("./idempotency");
    expect(await checkAndSetIdempotency("order-1")).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});

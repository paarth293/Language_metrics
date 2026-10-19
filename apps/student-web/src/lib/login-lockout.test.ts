import { beforeEach, describe, expect, it, vi } from "vitest";

// #35: login was limited per IP only, so credential stuffing spread over many
// addresses could keep guessing one account for ever.
const state = vi.hoisted(() => ({ client: null as Record<string, unknown> | null }));
vi.mock("./redis-client", () => ({ getRedisClient: () => state.client }));

/** Enough of ioredis for INCR/PEXPIRE/GET/PTTL on one key. */
function fakeRedis() {
  const keys = new Map<string, { value: number; expiresAt: number | null }>();
  const live = (key: string) => {
    const entry = keys.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      keys.delete(key);
      return null;
    }
    return entry;
  };
  return {
    keys,
    async incr(key: string) {
      const entry = live(key);
      if (entry) return (entry.value += 1);
      keys.set(key, { value: 1, expiresAt: null });
      return 1;
    },
    async pexpire(key: string, ms: number) {
      const entry = live(key);
      if (entry) entry.expiresAt = Date.now() + ms;
      return 1;
    },
    async get(key: string) {
      const entry = live(key);
      return entry ? String(entry.value) : null;
    },
    async pttl(key: string) {
      const entry = live(key);
      if (!entry) return -2;
      return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
    },
    async del(key: string) {
      return keys.delete(key) ? 1 : 0;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  state.client = fakeRedis();
});

const EMAIL = "student@example.test";

describe("per-email login lockout (#35)", () => {
  it("locks the account out after 5 failures and reports how long to wait", async () => {
    const m = await import("./login-lockout");
    for (let i = 0; i < 4; i++) await m.recordFailedLogin(EMAIL);
    expect(await m.loginLockoutSeconds(EMAIL)).toBe(0);

    await m.recordFailedLogin(EMAIL);
    const wait = await m.loginLockoutSeconds(EMAIL);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(15 * 60);
  });

  it("treats the email case-insensitively, so EMAIL and email share a count", async () => {
    const m = await import("./login-lockout");
    for (let i = 0; i < 5; i++) await m.recordFailedLogin(EMAIL.toUpperCase());
    expect(await m.loginLockoutSeconds(` ${EMAIL} `)).toBeGreaterThan(0);
  });

  it("forgets failures after a successful login", async () => {
    const m = await import("./login-lockout");
    for (let i = 0; i < 5; i++) await m.recordFailedLogin(EMAIL);
    await m.clearFailedLogins(EMAIL);
    expect(await m.loginLockoutSeconds(EMAIL)).toBe(0);
  });

  it("counts each account separately", async () => {
    const m = await import("./login-lockout");
    for (let i = 0; i < 5; i++) await m.recordFailedLogin(EMAIL);
    expect(await m.loginLockoutSeconds("someone.else@example.test")).toBe(0);
  });

  it("sets the window on the first failure and does not extend it", async () => {
    const redis = fakeRedis();
    state.client = redis;
    const m = await import("./login-lockout");
    await m.recordFailedLogin(EMAIL);
    const firstExpiry = [...redis.keys.values()][0]!.expiresAt;
    await m.recordFailedLogin(EMAIL);
    expect([...redis.keys.values()][0]!.expiresAt).toBe(firstExpiry);
  });

  it("does not lock anyone out when Redis is down", async () => {
    state.client = { ...fakeRedis(), get: async () => { throw new Error("Connection is closed."); } };
    vi.doMock("@repo/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
    const m = await import("./login-lockout");
    expect(await m.loginLockoutSeconds(EMAIL)).toBe(0);
  });

  it("still limits per instance when REDIS_URL is unset", async () => {
    state.client = null;
    const m = await import("./login-lockout");
    for (let i = 0; i < 5; i++) await m.recordFailedLogin(EMAIL);
    expect(await m.loginLockoutSeconds(EMAIL)).toBeGreaterThan(0);
    await m.clearFailedLogins(EMAIL);
    expect(await m.loginLockoutSeconds(EMAIL)).toBe(0);
  });

  it("never locks out for ever if the key somehow lost its TTL", async () => {
    const redis = fakeRedis();
    state.client = { ...redis, pttl: async () => -1, get: async () => "99" };
    const m = await import("./login-lockout");
    expect(await m.loginLockoutSeconds(EMAIL)).toBe(0);
  });
});

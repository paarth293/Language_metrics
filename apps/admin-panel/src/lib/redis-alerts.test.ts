import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventEmitter } from "node:events";

// #8e: a Redis connection error on any client raises an ops alert (the
// throttle in reportOpsAlert keeps reconnect storms to one alert per scope).
const alerts = vi.hoisted(() => ({ reportOpsAlert: vi.fn(async () => {}) }));
vi.mock("@repo/logger/ops-alert", () => alerts);

const clients = vi.hoisted(() => [] as EventEmitter[]);
vi.mock("ioredis", async () => {
  const { EventEmitter } = await import("node:events");
  // Every command fails, like a Redis that is down.
  class FakeRedis extends EventEmitter {
    status = "ready";
    constructor() {
      super();
      clients.push(this);
      return new Proxy(this, {
        get: (target, key, receiver) =>
          key in target || key === "then" || typeof key === "symbol"
            ? Reflect.get(target, key, receiver)
            : async () => { throw new Error("Connection is closed."); },
      });
    }
    async connect() {}
    pipeline() {
      const chain: object = new Proxy({}, {
        get: (_target, key) =>
          key === "exec" ? async () => { throw new Error("Connection is closed."); } : key === "then" ? undefined : () => chain,
      });
      return chain;
    }
  }
  return { default: FakeRedis, Redis: FakeRedis };
});

beforeEach(() => {
  vi.resetModules();
  clients.length = 0;
  alerts.reportOpsAlert.mockClear();
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const settle = (work: () => unknown) => Promise.resolve().then(work).catch(() => {});
const scopes = () => alerts.reportOpsAlert.mock.calls.map((call) => (call as unknown[])[1] as { scope: string }).map((d) => d.scope);

describe("admin-panel Redis clients alert on connection errors (#8e)", () => {
  it("rate-limit and redis-session", async () => {
    await settle(async () => (await import("./rate-limit")).rateLimit("login:1.2.3.4", { windowMs: 60_000, max: 5 }));
    await settle(async () => (await import("./redis-session")).verifyRefreshSession("user", "session"));
    expect(clients.length).toBe(2);
    for (const client of clients) client.emit("error", new Error("connect ECONNREFUSED"));
    expect(scopes().sort()).toEqual(["admin-panel rate-limit", "admin-panel redis-session"]);
  });
});

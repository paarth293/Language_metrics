import { describe, it, expect, vi, beforeEach } from "vitest";
import { withCache } from "./api-cache";
import { getRedisClient } from "./redis-client";

// Mock redis-client
const mockRedisData = new Map<string, string>();
const mockRedis = {
  get: vi.fn(async (key: string) => mockRedisData.get(key) ?? null),
  set: vi.fn(async (key: string, val: string) => {
    mockRedisData.set(key, val);
    return "OK";
  }),
  scanStream: vi.fn(() => ({
    on: vi.fn(),
  })),
  pipeline: vi.fn(() => ({
    del: vi.fn(),
    exec: vi.fn(),
  })),
};

vi.mock("./redis-client", () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

describe("api-cache Redis cache-aside", () => {
  beforeEach(() => {
    mockRedisData.clear();
    vi.clearAllMocks();
  });

  it("computes fresh response on cache MISS and returns X-Cache: MISS", async () => {
    let computeCount = 0;
    const fn = async () => {
      computeCount++;
      return new Response(JSON.stringify({ teachers: ["Alice"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await withCache("discover:test1", 60_000, fn);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(computeCount).toBe(1);

    const body = await res.json();
    expect(body).toEqual({ teachers: ["Alice"] });
  });

  it("serves from cache on repeated equivalent request and returns X-Cache: HIT without re-evaluating", async () => {
    let computeCount = 0;
    const fn = async () => {
      computeCount++;
      return new Response(JSON.stringify({ teachers: ["Bob"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    // First request: MISS
    const res1 = await withCache("discover:test2", 60_000, fn);
    expect(res1.headers.get("X-Cache")).toBe("MISS");
    expect(computeCount).toBe(1);

    // Second request: HIT
    const res2 = await withCache("discover:test2", 60_000, fn);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(computeCount).toBe(1); // Not called again!

    const body = await res2.json();
    expect(body).toEqual({ teachers: ["Bob"] });
  });

  it("maintains separate cache entries for different queries/currencies", async () => {
    const fnINR = async () => new Response(JSON.stringify({ currency: "INR" }), { status: 200 });
    const fnUSD = async () => new Response(JSON.stringify({ currency: "USD" }), { status: 200 });

    const resINR = await withCache("discover:lang=es:cur=INR", 60_000, fnINR);
    const resUSD = await withCache("discover:lang=es:cur=USD", 60_000, fnUSD);

    expect(await resINR.json()).toEqual({ currency: "INR" });
    expect(await resUSD.json()).toEqual({ currency: "USD" });
  });

  it("falls back gracefully to memory cache when Redis throws or times out", async () => {
    vi.mocked(getRedisClient).mockReturnValueOnce({
      get: vi.fn().mockRejectedValue(new Error("Connection lost")),
      set: vi.fn().mockRejectedValue(new Error("Connection lost")),
    } as unknown as ReturnType<typeof getRedisClient>);

    let computeCount = 0;
    const fn = async () => {
      computeCount++;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    // Should not throw!
    const res1 = await withCache("discover:fallback", 60_000, fn);
    expect(res1.status).toBe(200);
    expect(computeCount).toBe(1);

    // Subsequent request serves from memory fallback
    const res2 = await withCache("discover:fallback", 60_000, fn);
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(computeCount).toBe(1);
  });
});

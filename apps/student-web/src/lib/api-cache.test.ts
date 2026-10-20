import { describe, it, expect, vi, beforeEach } from "vitest";
import { withCache } from "./api-cache";

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

describe("student-web api-cache Redis cache-aside", () => {
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

    // Second request: HIT from Redis
    const res2 = await withCache("discover:test2", 60_000, fn);
    expect(res2.headers.get("X-Cache")).toBe("HIT");
    expect(computeCount).toBe(1); // Not called again!

    const body = await res2.json();
    expect(body).toEqual({ teachers: ["Bob"] });
  });

  it("isolates independent filter keys and avoids cross-contamination", async () => {
    const fnEnglish = async () =>
      new Response(JSON.stringify({ language: "English" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const fnSpanish = async () =>
      new Response(JSON.stringify({ language: "Spanish" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const resEng = await withCache("discover:lang=en:cur=INR", 60_000, fnEnglish);
    const resSpa = await withCache("discover:lang=es:cur=INR", 60_000, fnSpanish);

    expect((await resEng.json()).language).toBe("English");
    expect((await resSpa.json()).language).toBe("Spanish");
  });

  it("gracefully falls back when Redis throws or times out", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("Redis connection refused"));

    const fn = async () =>
      new Response(JSON.stringify({ fallback: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const res = await withCache("discover:fallback", 60_000, fn);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ fallback: true });
  });

  it("skips caching when response has x-skip-cache header", async () => {
    let computeCount = 0;
    const fn = async () => {
      computeCount++;
      return new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-skip-cache": "1" },
      });
    };

    const res1 = await withCache("auth:me:test", 30_000, fn);
    expect(computeCount).toBe(1);
    expect(res1.headers.get("X-Cache")).toBeNull();

    const res2 = await withCache("auth:me:test", 30_000, fn);
    expect(res2.headers.get("X-Cache")).toBeNull();
    expect(computeCount).toBe(2);
  });
});

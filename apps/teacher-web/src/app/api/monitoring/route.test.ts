// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #36: the "same-origin" check was just origin.includes(host), which any
// non-browser client can forge by sending an Origin header. The route also
// returned raw DB error messages.
const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(async () => [{ 1: 1 }]),
  count: vi.fn(async () => 1),
  ping: vi.fn(async () => "PONG"),
  redis: true,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
    studentProfile: { count: mocks.count },
    teacherProfile: { count: mocks.count },
    booking: { count: mocks.count },
  },
}));
vi.mock("@/lib/redis-client", () => ({ getRedisClient: () => (mocks.redis ? { ping: mocks.ping } : null) }));

const KEY = "monitoring-key-for-tests";

function request(headers: Record<string, string> = {}) {
  return new Request("https://teacher.example.test/api/monitoring", { headers });
}

beforeEach(() => {
  vi.resetModules();
  mocks.queryRaw.mockClear();
  mocks.redis = true;
  mocks.queryRaw.mockResolvedValue([{ 1: 1 }]);
  vi.stubEnv("MONITORING_API_KEY", KEY);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/monitoring (#36)", () => {
  it("accepts the configured key", async () => {
    const { GET } = await import("./route");
    const res = await GET(request({ authorization: `Bearer ${KEY}` }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });

  it("rejects a forged Origin that merely contains the host", async () => {
    const { GET } = await import("./route");
    const res = await GET(request({ origin: "https://teacher.example.test", host: "teacher.example.test" }));
    expect(res.status).toBe(401);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a wrong or absent key", async () => {
    const { GET } = await import("./route");
    // A prefix, an extension and the key without its scheme must all fail.
    for (const headers of [{}, { authorization: "Bearer wrong" }, { authorization: KEY }, { authorization: `Bearer ${KEY.slice(0, -1)}` }, { authorization: `Bearer ${KEY}x` }, { authorization: `Basic ${KEY}` }]) {
      expect((await GET(request(headers))).status).toBe(401);
    }
  });

  it("stays closed when no key is configured", async () => {
    vi.stubEnv("MONITORING_API_KEY", "");
    const { GET } = await import("./route");
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request({ authorization: "Bearer " }))).status).toBe(401);
  });

  it("never returns a raw database error", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("Can't reach database server at db.internal:5432, password=hunter2"));
    const { GET } = await import("./route");
    const res = await GET(request({ authorization: `Bearer ${KEY}` }));
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("db.internal");
    expect(body).not.toContain("hunter2");
    expect(body).toContain("unhealthy");
  });
});

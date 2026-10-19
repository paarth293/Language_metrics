import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// #8e: a cron that fails tells a human, instead of only writing a log line
// nobody reads.
const alerts = vi.hoisted(() => ({ reportOpsAlert: vi.fn(async () => {}) }));
const sweeps = vi.hoisted(() => ({
  reconcilePaymentOrders: vi.fn(),
  reconcileStaleSessions: vi.fn(),
}));
vi.mock("@repo/logger/ops-alert", () => alerts);
vi.mock("@repo/live-classes", () => ({
  ...sweeps,
  withCronLock: async (_name: string, run: () => Promise<unknown>) => ({ ran: true, result: await run() }),
}));

const SECRET = "cron-secret-for-tests";
const request = (path: string) =>
  new NextRequest(`http://localhost/api/cron/${path}`, { headers: { authorization: `Bearer ${SECRET}` } });

beforeEach(() => {
  vi.resetModules();
  alerts.reportOpsAlert.mockClear();
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe.each([
  ["reconcile-payments", () => import("./reconcile-payments/route"), sweeps.reconcilePaymentOrders],
  ["reconcile-sessions", () => import("./reconcile-sessions/route"), sweeps.reconcileStaleSessions],
] as const)("GET /api/cron/%s alerts on failure (#8e)", (name, load, sweep) => {
  it("alerts and answers 500 when the sweep throws", async () => {
    sweep.mockRejectedValueOnce(new Error("Can't reach database server"));
    const { GET } = await load();
    const response = await GET(request(name));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "Cron run failed." });
    expect(alerts.reportOpsAlert).toHaveBeenCalledWith("cron_failed", expect.objectContaining({ scope: name }));
  });

  it("alerts when CRON_SECRET is missing, since the cron can never run", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await load();
    expect((await GET(request(name))).status).toBe(500);
    expect(alerts.reportOpsAlert).toHaveBeenCalledWith("cron_failed", expect.objectContaining({ scope: name }));
  });

  it("does not alert on a clean run", async () => {
    sweep.mockResolvedValueOnce({ failed: [], stuck: [] });
    const { GET } = await load();
    expect((await GET(request(name))).status).toBe(200);
    expect(alerts.reportOpsAlert).not.toHaveBeenCalled();
  });
});

it("reconcile-sessions alerts when some sessions failed to settle", async () => {
  sweeps.reconcileStaleSessions.mockResolvedValueOnce({ failed: [{ sessionId: "s1", error: "x" }] });
  const { GET } = await import("./reconcile-sessions/route");
  expect((await GET(request("reconcile-sessions"))).status).toBe(200);
  expect(alerts.reportOpsAlert).toHaveBeenCalledWith("cron_failed", expect.objectContaining({ scope: "reconcile-sessions" }));
});

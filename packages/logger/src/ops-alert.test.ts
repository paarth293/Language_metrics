import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ALERT_URL = "https://hooks.example.test/ops";
let posts: { url: string; body: Record<string, unknown>; signal: AbortSignal | null | undefined }[] = [];
let lines: string[] = [];

beforeEach(() => {
  vi.resetModules();
  posts = [];
  lines = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init.body)), signal: init.signal });
    return new Response(null, { status: 200 });
  }));
  vi.spyOn(console, "error").mockImplementation((line: string) => void lines.push(line));
  vi.stubEnv("OPS_ALERT_WEBHOOK_URL", ALERT_URL);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("reportOpsAlert (#8e)", () => {
  it("logs the alert and POSTs it to OPS_ALERT_WEBHOOK_URL with a timeout, secrets masked", async () => {
    const { reportOpsAlert } = await import("./ops-alert");
    const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2ln"].join(".");
    await reportOpsAlert("cron_failed", { scope: "reconcile-payments", error: new Error(`token ${jwt}`) });

    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe(ALERT_URL);
    expect(posts[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(posts[0]!.body).toMatchObject({ kind: "cron_failed", text: expect.stringContaining("cron_failed (reconcile-payments)") });
    expect(posts[0]!.body.text).toBe(posts[0]!.body.content); // Slack and Discord
    expect(JSON.stringify(posts[0]!.body)).not.toContain(jwt);
    expect(lines.some((line) => line.includes('"msg":"[ops-alert]"'))).toBe(true);
  });

  it("only logs when OPS_ALERT_WEBHOOK_URL is not set", async () => {
    vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "");
    const { reportOpsAlert } = await import("./ops-alert");
    await reportOpsAlert("db_error", { reason: "down" });
    expect(posts).toHaveLength(0);
    expect(lines).toHaveLength(1);
  });

  it("sends at most one alert per kind and scope every 5 minutes, then reports how many it held back", async () => {
    vi.useFakeTimers({ now: 0 });
    const { reportOpsAlert } = await import("./ops-alert");
    for (let i = 0; i < 50; i++) await reportOpsAlert("redis_error", { scope: "rate-limit" });
    await reportOpsAlert("redis_error", { scope: "redis-session" }); // a different scope is its own stream
    expect(posts).toHaveLength(2);

    vi.setSystemTime(5 * 60_000 + 1);
    await reportOpsAlert("redis_error", { scope: "rate-limit" });
    expect(posts).toHaveLength(3);
    expect(posts[2]!.body.suppressed).toBe(49);
    expect(posts[2]!.body.text).toContain("49 similar");
  });

  it("never throws when the alert endpoint is down or hangs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const { reportOpsAlert } = await import("./ops-alert");
    await expect(reportOpsAlert("db_error", {})).resolves.toBeUndefined();
    expect(lines.some((line) => line.includes("ops alert delivery failed"))).toBe(true);
  });
});

describe("noteServerError: repeated 5xx (#8e)", () => {
  it("alerts once 3 server errors land within 5 minutes on the same scope", async () => {
    vi.useFakeTimers({ now: 0 });
    const { noteServerError } = await import("./ops-alert");
    await noteServerError("payments/create-order", 500);
    await noteServerError("payments/create-order", 502);
    expect(posts).toHaveLength(0);
    await noteServerError("payments/create-order", 500);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toMatchObject({ kind: "payment_5xx", detail: { scope: "payments/create-order", count: 3 } });
  });

  it("does not alert on errors spread out over more than 5 minutes", async () => {
    vi.useFakeTimers({ now: 0 });
    const { noteServerError } = await import("./ops-alert");
    for (let i = 0; i < 5; i++) {
      await noteServerError("payments/verify-payment", 500);
      vi.setSystemTime((i + 1) * 3 * 60_000);
    }
    expect(posts).toHaveLength(0);
  });

  it("withServerErrorAlerts counts 5xx responses and thrown errors, not 4xx", async () => {
    vi.useFakeTimers({ now: 0 });
    const { withServerErrorAlerts } = await import("./ops-alert");
    let status = 400;
    const handler = withServerErrorAlerts<[Request]>("webhooks/cashfree", async () => new Response(null, { status }));
    for (let i = 0; i < 5; i++) await handler(new Request("http://x"));
    expect(posts).toHaveLength(0);
    status = 503;
    await handler(new Request("http://x"));
    await handler(new Request("http://x"));
    const throwing = withServerErrorAlerts<[Request]>("webhooks/cashfree", async () => { throw new Error("boom"); });
    await expect(throwing(new Request("http://x"))).rejects.toThrow("boom");
    expect(posts).toHaveLength(1);
  });
});

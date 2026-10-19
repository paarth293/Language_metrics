import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest, loggedIncidents } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { reportPaymentIncident } = await import("@repo/live-classes");

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => { harness.reset(); errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { harness.teardown(); errors.mockRestore(); });

const root = join(__dirname, "..", "..");
const DB_PASSWORD = "pw-secret-9";
const dbError = () => new Error(`connect ECONNREFUSED postgresql://app:${DB_PASSWORD}@db.internal:5432/app`);
/** Every console.error call that is a JSON log line, parsed. */
const jsonLines = () => errors.mock.calls.flatMap(([line]) => {
  try { return [JSON.parse(String(line)) as Record<string, unknown>]; } catch { return []; }
});

describe("#8c payment and webhook code logs JSON with the request ID", () => {
  it("has no console.* left in the payment and webhook paths", () => {
    const files = [
      "packages/live-classes/src/cashfree.ts",
      "packages/live-classes/src/cron-lock.ts",
      "packages/live-classes/src/payment-incidents.ts",
      "packages/live-classes/src/webhook.ts",
      ...["student-web", "teacher-web"].flatMap((app) => [
        "payments/create-order", "payments/verify-payment", "webhooks/cashfree", "webhooks/livekit",
        "students/payments/cashfree/order", "students/payments/cashfree/verify",
      ].map((route) => `apps/${app}/src/app/api/${route}/route.ts`)),
      "apps/admin-panel/src/app/api/admin/payments/[orderId]/refund/route.ts",
    ];
    const offenders = files.flatMap((file) =>
      readFileSync(join(root, file), "utf8").split("\n")
        .map((line, i) => (/\bconsole\.(log|info|warn|error|debug)\(/.test(line) ? `${file}:${i + 1}` : null))
        .filter((hit): hit is string => hit !== null));
    expect(offenders).toEqual([]);
  });

  it("create-order: an unexpected error is one JSON line with the request ID, the DB password masked", async () => {
    vi.spyOn(harness.db.db.paymentOrder, "create").mockRejectedValueOnce(dbError());
    const request = jsonRequest("/api/payments/create-order", { packageId: "tier1" });
    request.headers.set("x-request-id", "req-pay-1");
    expect((await createOrder(request)).status).toBe(500);

    const lines = jsonLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: "error", requestId: "req-pay-1", msg: "order creation failed" });
    expect(JSON.stringify(lines[0])).not.toContain(DB_PASSWORD);
  });

  it("Cashfree webhook: an unexpected error is one JSON line with the request ID", async () => {
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
    const payment = harness.cashfree.pay(orderId, "SUCCESS");
    vi.spyOn(harness.db.db.paymentOrder, "findUnique").mockRejectedValue(dbError());

    const signed = harness.cashfree.webhookRequest(harness.cashfree.successWebhook(orderId, payment));
    const headers = new Headers(signed.headers);
    headers.set("x-request-id", "req-wh-1");
    const response = await webhook(new Request(signed.url, { method: "POST", headers, body: await signed.text() }));
    expect(response.status).toBe(500);

    const line = jsonLines().find((entry) => entry.msg === "cashfree webhook failed");
    expect(line).toMatchObject({ level: "error", requestId: "req-wh-1" });
    expect(JSON.stringify(line)).not.toContain(DB_PASSWORD);
  });

  it("payment incidents are JSON lines tagged [payment-incident]", async () => {
    await reportPaymentIncident({ kind: "stuck_orders", orderIds: ["coins_1"], reason: "test" });
    expect(loggedIncidents(errors)).toEqual([{ kind: "stuck_orders", orderIds: ["coins_1"], reason: "test" }]);
  });
});

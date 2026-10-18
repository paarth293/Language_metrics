import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { POST: verifyRecording } = await import("@/app/api/students/payments/cashfree/verify/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const RECORDING_OF_B = "33333333-3333-4333-8333-333333333333";

describe("5. IDOR: student A cannot touch student B's orders or payments", () => {
  it("A cannot verify (and so cannot claim the coins of) B's paid order", async () => {
    harness.signIn("student-b");
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier3" }))).json()).orderId;
    harness.cashfree.pay(orderId, "SUCCESS");

    harness.signIn("student-a");
    const callsBefore = harness.cashfree.calls.length;
    const response = await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    expect(response.status).toBe(404);
    expect(harness.cashfree.calls.length).toBe(callsBefore);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
    expect(harness.db.balances.get("student-b") ?? 0).toBe(0);
  });

  it("A cannot buy or unlock a recording from B's booking", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING_OF_B, bookingId: "booking-b", booking: { studentId: "student-b" } } });
    harness.signIn("student-a");
    expect((await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING_OF_B }))).status).toBe(404);
    expect(harness.cashfree.calls).toHaveLength(0);
  });

  it("A cannot verify B's recording order", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING_OF_B, bookingId: "booking-b", booking: { studentId: "student-b" } } });
    harness.signIn("student-b");
    const orderId = (await (await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING_OF_B }))).json()).orderId;
    harness.cashfree.pay(orderId, "SUCCESS");
    harness.signIn("student-a");
    expect((await verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId }))).status).toBe(404);
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING_OF_B } }))?.isRecordingPaid).toBe(false);
  });

  it("an unauthenticated caller is refused before any gateway call", async () => {
    harness.signIn(null);
    expect((await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).status).toBe(401);
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId: "coins_100_x" }))).status).toBe(401);
    expect(harness.cashfree.calls).toHaveLength(0);
  });
});

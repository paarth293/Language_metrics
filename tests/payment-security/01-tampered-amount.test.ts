import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

describe("1. tampered amount on create-order", () => {
  it.each([
    ["a cheaper price for a real pack", { packageId: "tier3", amount: 1 }],
    ["a negative amount", { amount: -100 }],
    ["a fractional amount", { amount: 99.5 }],
    ["an amount matching no pack", { amount: 101 }],
    ["a different currency", { packageId: "tier1", currency: "USD" }],
    ["an unknown pack", { packageId: "tier-free" }],
  ])("rejects %s and never contacts Cashfree", async (_label, body) => {
    const response = await createOrder(jsonRequest("/api/payments/create-order", body));
    expect(response.status).toBe(400);
    expect(harness.cashfree.calls).toHaveLength(0);
    expect(await harness.db.db.paymentOrder.count()).toBe(0);
  });

  it("charges the server price even when the client sends extra coin fields", async () => {
    const response = await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1", coins: 999999, order_amount: 1 }));
    expect(response.status).toBe(200);
    const [order] = [...harness.cashfree.orders.values()];
    expect(order).toMatchObject({ order_amount: 100, order_currency: "INR" });
    const [saved] = await harness.db.db.paymentOrder.findMany();
    expect(saved).toMatchObject({ amount: 100, status: "CREATED", receipt: expect.stringMatching(/^coins_100_/) });
  });

  it("ignores a client-sent amount for recordings and charges the fixed ₹299", async () => {
    await harness.db.db.classSession.create({ data: { id: "11111111-1111-4111-8111-111111111111", bookingId: "booking-a", booking: { studentId: "student-a" } } });
    const response = await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: "11111111-1111-4111-8111-111111111111", amount: 1 }));
    expect(response.status).toBe(200);
    expect([...harness.cashfree.orders.values()][0]).toMatchObject({ order_amount: 299 });
  });
});

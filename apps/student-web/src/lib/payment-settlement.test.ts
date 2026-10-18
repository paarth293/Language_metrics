import { beforeEach, describe, expect, it, vi } from "vitest";
import { settlePayment } from "./payment-settlement";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), updateMany: vi.fn(), credit: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@repo/database", () => ({
  credit: mocks.credit,
  db: { $transaction: mocks.transaction },
}));

const payment = { id: "pay_1", order_id: "order_1", amount: 10000, currency: "INR", status: "SUCCESS" };
const order = { id: "db-order", orderId: "order_1", userId: "student-1", amount: 100, currency: "INR", status: "CREATED", receipt: "coins_100_snapshot", paymentId: null };
const tx = { paymentOrder: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.findUnique.mockResolvedValue(order);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.credit.mockResolvedValue(undefined);
});

describe("payment settlement", () => {
  it("credits the saved coin quantity to the order owner inside the same transaction", async () => {
    await settlePayment(payment, "student-1");
    expect(mocks.credit).toHaveBeenCalledWith(expect.objectContaining({
      userId: "student-1", amount: 100, idempotencyKey: "cashfree:order_1",
    }), tx);
  });

  it.each([
    [{ ...payment, amount: 100 }, "student-1"],
    [{ ...payment, currency: "USD" }, "student-1"],
    [{ ...payment, status: "PENDING" }, "student-1"],
    [payment, "another-student"],
  ])("rejects mismatched, uncaptured, and foreign payments", async (details, user) => {
    await expect(settlePayment(details, user)).rejects.toThrow();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("skips credit when another callback already claimed the order", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await settlePayment(payment);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("skips repeated confirmation of an already paid order", async () => {
    mocks.findUnique.mockResolvedValue({ ...order, status: "PAID", paymentId: "pay_1" });
    await settlePayment(payment);
    expect(mocks.credit).not.toHaveBeenCalled();
  });

  it("rejects a different payment for an already paid order", async () => {
    mocks.findUnique.mockResolvedValue({ ...order, status: "PAID", paymentId: "pay_other" });
    await expect(settlePayment(payment)).rejects.toThrow("another payment");
  });

  it("propagates ledger failures out of the transaction so payment status rolls back", async () => {
    mocks.credit.mockRejectedValue(new Error("ledger unavailable"));
    await expect(settlePayment(payment)).rejects.toThrow("ledger unavailable");
  });

  it("converts an order without a coin snapshot at 1 coin = ₹1", async () => {
    mocks.findUnique.mockResolvedValue({ ...order, receipt: "receipt_legacy" });
    await settlePayment(payment);
    expect(mocks.credit).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }), tx);
  });
});

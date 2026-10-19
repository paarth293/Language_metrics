import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CashfreeError, createCashfreeOrder, createCashfreeRefund, fetchSuccessfulPayment } from "./cashfree";

// A real server that accepts every request and never answers. Every Cashfree
// URL is redirected to it with the caller's init (including its signal) intact,
// so only a timeout set by our code can end the request.
let server: Server;
let slowUrl = "";
beforeAll(async () => {
  server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  slowUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const realFetch = globalThis.fetch;
const realTimeout = AbortSignal.timeout.bind(AbortSignal);
/** Timeouts our code asked for; each is actually run as 200 ms to keep the suite fast. */
let requested: number[] = [];

beforeEach(() => {
  requested = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    requested.push(ms);
    return realTimeout(200);
  });
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => realFetch(slowUrl + new URL(url).pathname, init));
  vi.stubEnv("CASHFREE_ENV", "sandbox");
  vi.stubEnv("CASHFREE_CLIENT_ID", "TEST-id");
  vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function failure(promise: Promise<unknown>) {
  const started = Date.now();
  const error = await promise.then(() => null, (e: unknown) => e);
  return { error: error as CashfreeError, ms: Date.now() - started };
}

describe("Cashfree calls give up on a provider that never answers", () => {
  it("create order (POST): one 10 s attempt, then a clear 504, no retry", async () => {
    const { error, ms } = await failure(createCashfreeOrder({ orderId: "coins_1_x", amountInr: 100, customerId: "u" }));
    expect(error).toBeInstanceOf(CashfreeError);
    expect(error.status).toBe(504);
    expect(error.message).toBe("Payment provider did not respond in time. Please try again.");
    expect(requested).toEqual([10_000]);
    expect(ms).toBeLessThan(2_000);
  });

  it("refund (POST): one 10 s attempt, then a clear 504, no retry", async () => {
    const { error } = await failure(createCashfreeRefund({ orderId: "coins_1_x", refundId: "rf_coins_1_x", amountInr: 100, note: "n" }));
    expect(error).toBeInstanceOf(CashfreeError);
    expect(error.status).toBe(504);
    expect(requested).toEqual([10_000]);
  });

  it("payment lookup (GET): 10 s per attempt, retried once, then a clear 504", async () => {
    const { error, ms } = await failure(fetchSuccessfulPayment("coins_1_x"));
    expect(error).toBeInstanceOf(CashfreeError);
    expect(error.status).toBe(504);
    expect(error.message).toBe("Payment provider did not respond in time. Please try again.");
    expect(requested).toEqual([10_000, 10_000]);
    expect(ms).toBeLessThan(2_000);
  });
});

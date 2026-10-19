import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A real server that accepts every request and never answers; the FX URL is
// redirected to it with the caller's init (and signal) kept.
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
let requested: number[] = [];

beforeEach(() => {
  vi.resetModules(); // fresh rate cache
  requested = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    requested.push(ms);
    return realTimeout(200);
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const slowFetch = (url: string, init?: RequestInit) => realFetch(slowUrl + new URL(url).pathname, init);

describe("getExchangeRate gives up on a rate service that never answers", () => {
  it("fails within the 5 s timeout with a clear error when nothing is cached", async () => {
    vi.stubGlobal("fetch", slowFetch);
    const { getExchangeRate } = await import("./index");
    const started = Date.now();
    await expect(getExchangeRate("INR", "USD")).rejects.toThrow("Exchange-rate service did not respond in time");
    expect(requested).toEqual([5_000]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("still serves the stale cached rate when the refresh times out", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ rates: { EUR: 0.011 } })));
      const { getExchangeRate } = await import("./index");
      expect(await getExchangeRate("INR", "EUR")).toBe(0.011);

      vi.setSystemTime(Date.now() + 7 * 60 * 60_000); // past the 6 h cache TTL
      vi.stubGlobal("fetch", slowFetch);
      expect(await getExchangeRate("INR", "EUR")).toBe(0.011);
      expect(requested).toEqual([5_000, 5_000]);
    } finally {
      vi.useRealTimers();
    }
  });
});

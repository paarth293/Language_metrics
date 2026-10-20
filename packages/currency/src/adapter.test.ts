import { describe, it, expect, vi, beforeEach } from "vitest";
import { getExchangeRate, setExchangeRateCacheAdapter, type ExchangeRateCacheAdapter } from "./index";

describe("ExchangeRateCacheAdapter integration", () => {
  beforeEach(() => {
    setExchangeRateCacheAdapter(null);
    vi.restoreAllMocks();
  });

  it("retrieves exchange rate from adapter on cache miss without calling external API", async () => {
    const mockAdapter: ExchangeRateCacheAdapter = {
      get: vi.fn(async () => 1.25),
      set: vi.fn(async () => {}),
    };

    setExchangeRateCacheAdapter(mockAdapter);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const rate = await getExchangeRate("USD", "SGD");

    expect(rate).toBe(1.25);
    expect(mockAdapter.get).toHaveBeenCalledWith("USD_SGD");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores newly fetched exchange rate into adapter", async () => {
    const mockAdapter: ExchangeRateCacheAdapter = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
    };

    setExchangeRateCacheAdapter(mockAdapter);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rates: { HKD: 7.8 } }),
      })
    );

    const rate = await getExchangeRate("USD", "HKD");

    expect(rate).toBe(7.8);
    expect(mockAdapter.set).toHaveBeenCalledWith("USD_HKD", 7.8, expect.any(Number));
  });
});

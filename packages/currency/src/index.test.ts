import { afterEach, describe, expect, it, vi } from "vitest";
import { convertMinorUnits, formatMoney, getCurrencyInfo, getExchangeRate, isSupportedCurrency } from "./index";

describe("isSupportedCurrency / getCurrencyInfo", () => {
  it("recognises curated currencies", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("XXX")).toBe(false);
  });

  it("falls back to the raw code for an unknown currency", () => {
    expect(getCurrencyInfo("XXX")).toEqual({ code: "XXX", symbol: "XXX", label: "XXX", decimals: 2 });
  });

  it("knows JPY has no minor unit", () => {
    expect(getCurrencyInfo("JPY").decimals).toBe(0);
  });
});

describe("getExchangeRate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 1 for a same-currency pair without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(getExchangeRate("INR", "INR")).resolves.toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a successful Frankfurter response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { INR: 91.2 } }), { status: 200 }))
    );
    await expect(getExchangeRate("USD", "INR")).resolves.toBeCloseTo(91.2);
  });

  it("throws when Frankfurter has no cached fallback and the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    );
    await expect(getExchangeRate("EUR", "JPY")).rejects.toThrow();
  });
});

describe("convertMinorUnits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the amount through unchanged for a same-currency pair", async () => {
    await expect(convertMinorUnits(50000, "INR", "INR")).resolves.toBe(50000);
  });

  it("converts across currencies and decimal precisions", async () => {
    // ₹500.00 (paise) -> USD at rate 0.012 -> $6.00 (cents)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { USD: 0.012 } }), { status: 200 }))
    );
    await expect(convertMinorUnits(50000, "INR", "USD")).resolves.toBe(600);
  });

  it("rounds JPY (0 decimals) correctly", async () => {
    // $8.00 (800 cents) -> JPY at rate 150 -> ¥1200 (no minor unit)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ rates: { JPY: 150 } }), { status: 200 }))
    );
    await expect(convertMinorUnits(800, "USD", "JPY")).resolves.toBe(1200);
  });
});

describe("formatMoney", () => {
  it("formats a 2-decimal currency", () => {
    expect(formatMoney(50000, "INR")).toBe("₹500");
  });

  it("formats a 0-decimal currency without a fractional part", () => {
    expect(formatMoney(1200, "JPY")).toContain("1,200");
  });
});

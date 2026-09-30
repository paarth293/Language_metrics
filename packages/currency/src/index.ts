/**
 * @repo/currency — teacher rates are stored in the teacher's own chosen
 * currency; this is the one place that converts a stored amount into what a
 * student (or any other viewer) should see, so every app applies the same
 * rate, the same rounding, and the same fallback behaviour.
 *
 * Exchange rates come from Frankfurter (https://frankfurter.dev), a free,
 * keyless, ECB-sourced daily rate service — no account or secret to manage.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  label: string;
  /** Decimal places in the currency's smallest unit (JPY has none; most have 2). */
  decimals: number;
}

/**
 * The teacher-facing currency picker. Limited to currencies Frankfurter
 * actually prices (ECB reference list) so every rate can be converted.
 */
export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", decimals: 2 },
  { code: "USD", symbol: "$", label: "US Dollar", decimals: 2 },
  { code: "EUR", symbol: "€", label: "Euro", decimals: 2 },
  { code: "GBP", symbol: "£", label: "British Pound", decimals: 2 },
  { code: "CAD", symbol: "$", label: "Canadian Dollar", decimals: 2 },
  { code: "AUD", symbol: "$", label: "Australian Dollar", decimals: 2 },
  { code: "SGD", symbol: "$", label: "Singapore Dollar", decimals: 2 },
  { code: "HKD", symbol: "$", label: "Hong Kong Dollar", decimals: 2 },
  { code: "JPY", symbol: "¥", label: "Japanese Yen", decimals: 0 },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc", decimals: 2 },
  { code: "ZAR", symbol: "R", label: "South African Rand", decimals: 2 },
  { code: "NZD", symbol: "$", label: "New Zealand Dollar", decimals: 2 },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

const CURRENCY_MAP = new Map(CURRENCIES.map((c) => [c.code, c]));

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_MAP.has(code);
}

export function getCurrencyInfo(code: string): CurrencyInfo {
  return CURRENCY_MAP.get(code) ?? { code, symbol: code, label: code, decimals: 2 };
}

// ── Exchange rates ─────────────────────────────────────────────────────────

type CacheEntry = { rate: number; expiresAt: number };
const rateCache = new Map<string, CacheEntry>();
// Frankfurter refreshes once a day on weekdays; a few hours of staleness is
// invisible to a student and keeps us from hitting it on every page view.
const CACHE_TTL_MS = 6 * 60 * 60_000;

/**
 * 1 unit of `from` expressed in `to`. Returns 1 for a same-currency pair
 * without any network call. Falls back to the last cached rate (even if
 * stale) if the live fetch fails, so a network hiccup never breaks price
 * display — only throws if we have never successfully fetched this pair.
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.rate;

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
    if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      throw new Error(`Frankfurter did not return a rate for ${from}->${to}`);
    }
    rateCache.set(key, { rate, expiresAt: Date.now() + CACHE_TTL_MS });
    return rate;
  } catch (err) {
    if (cached) return cached.rate; // stale beats broken
    console.error(`[currency] Failed to fetch ${from}->${to} exchange rate:`, err);
    throw err;
  }
}

/**
 * Converts an integer amount in `from`'s smallest unit (e.g. paise) into
 * `to`'s smallest unit, using the live rate. Result is rounded to the
 * nearest whole minor unit.
 */
export async function convertMinorUnits(amountMinor: number, from: string, to: string): Promise<number> {
  if (from === to) return amountMinor;
  const fromDecimals = getCurrencyInfo(from).decimals;
  const toDecimals = getCurrencyInfo(to).decimals;
  const majorAmount = amountMinor / 10 ** fromDecimals;
  const rate = await getExchangeRate(from, to);
  return Math.round(majorAmount * rate * 10 ** toDecimals);
}

/** Same as {@link convertMinorUnits}, but never throws — returns the original amount/currency on failure. */
export async function convertMinorUnitsSafe(
  amountMinor: number,
  from: string,
  to: string
): Promise<{ amount: number; currency: string; converted: boolean }> {
  if (from === to) return { amount: amountMinor, currency: to, converted: true };
  try {
    return { amount: await convertMinorUnits(amountMinor, from, to), currency: to, converted: true };
  } catch {
    return { amount: amountMinor, currency: from, converted: false };
  }
}

/** Formats an integer minor-unit amount as a localized currency string, e.g. `formatMoney(50000, "INR")` → "₹500". */
export function formatMoney(amountMinor: number, code: string, locale = "en-IN"): string {
  const info = getCurrencyInfo(code);
  const major = amountMinor / 10 ** info.decimals;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: info.decimals,
    }).format(major);
  } catch {
    // Intl doesn't recognise the code (shouldn't happen for our curated list).
    return `${info.symbol}${major.toLocaleString(locale, { maximumFractionDigits: info.decimals })}`;
  }
}

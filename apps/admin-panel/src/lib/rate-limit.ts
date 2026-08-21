/**
 * In-memory sliding-window rate limiter for the admin login action.
 *
 * NOTE (see SECURITY.md): this is acceptable for single-instance
 * dev/staging only. Before horizontal scaling, replace with
 * @upstash/ratelimit (Redis) so counters are shared across instances.
 */

interface Window {
  timestamps: number[];
}

declare global {
  var rateLimitGlobal: Map<string, Window> | undefined;
}

const store = globalThis.rateLimitGlobal || new Map<string, Window>();
if (process.env.NODE_ENV !== "production") {
  globalThis.rateLimitGlobal = store;
}

function prune(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((t) => now - t < windowMs);
}

/**
 * Returns true when `identifier` has already made `max` attempts
 * inside the window (caller should respond with 429).
 * Does NOT record the current attempt — call `recordAttempt` after.
 */
export function isRateLimited(
  identifier: string,
  {
    windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max = Number(process.env.RATE_LIMIT_MAX) || 4,
  }: { windowMs?: number; max?: number } = {},
): boolean {
  const now = Date.now();
  const entry = store.get(identifier);
  if (!entry) return false;
  entry.timestamps = prune(entry.timestamps, windowMs, now);
  return entry.timestamps.length >= max;
}

/** Record one attempt for the identifier. */
export function recordAttempt(
  identifier: string,
  {
    windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  }: { windowMs?: number } = {},
): void {
  const now = Date.now();
  const entry = store.get(identifier) ?? { timestamps: [] };
  entry.timestamps = prune(entry.timestamps, windowMs, now);
  entry.timestamps.push(now);
  store.set(identifier, entry);
}

/**
 * Key by IP and by username so rotating either alone cannot bypass the limit.
 * Returns true if either key is limited (after recording both).
 */
export function checkAndRecordLoginAttempt(
  ip: string,
  username: string,
): boolean {
  const ipKey = `ip:${ip || "unknown"}`;
  const userKey = `user:${(username || "unknown").toLowerCase()}`;

  if (isRateLimited(ipKey) || isRateLimited(userKey)) {
    return true;
  }
  recordAttempt(ipKey);
  recordAttempt(userKey);
  return false;
}

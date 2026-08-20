// Fixed-window in-memory rate limiter. Suitable for a single-instance admin
// panel; for horizontally scaled deployments replace with a shared store
// (Redis) or a DB-backed counter. Login attempts are ALSO persisted to the
// LoginAttempt table for forensic audit regardless of this limiter.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * @returns {ok} false when the key has exceeded the window limit.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  if (bucket.count >= opts.limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * lib/rate-limit.ts — Redis-backed sliding-window rate limiter (admin panel)
 *
 * Previously this was an in-process `Map` only. On a serverless/multi-
 * instance deployment (Vercel) that provides effectively no real brute-force
 * protection: every cold start (and every separate instance handling
 * concurrent requests) gets its own empty Map, so an attacker distributing
 * login attempts across a handful of requests never trips the limiter.
 * teacher-web and student-web already solved this with a Redis sorted-set
 * sliding window (see their lib/rate-limit.ts); this mirrors that approach
 * using the same `ioredis` client pattern as ./redis-session.ts.
 *
 * Falls back to the in-process limiter only when REDIS_URL is not set
 * (e.g. local dev without Redis running) — that fallback resets on every
 * cold start and does NOT provide real protection, so REDIS_URL must be
 * configured in any deployed environment.
 *
 * Login attempts are ALSO persisted to the LoginAttempt table for forensic
 * audit regardless of this limiter.
 */

import Redis from "ioredis";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

// ── In-process fallback (dev only / Redis unavailable) ──────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Fix (errors.md #C6 / #M3): the in-memory Map above only ever grew — a
// bucket was created per unique key (per IP, per email) and never removed
// once its window expired, so a long-running dev/staging process (or any
// production instance that silently fell back to this path — see the
// REDIS_URL warning below) would accumulate one entry per distinct
// attacker/user forever, a slow unbounded memory leak. Sweep expired
// buckets on an interval instead of leaving them for GC to never collect
// (they're referenced from the module-level Map, so GC can't touch them).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
// Typed explicitly as NodeJS.Timeout (not `ReturnType<typeof setInterval>`)
// because this file only ever runs server-side under Node; leaving it
// inferred can silently pick up the DOM lib's `number` return type instead
// in some tsconfig/lib combinations, which has no `.unref()`.
let sweepTimer: NodeJS.Timeout | null = null;

function ensureSweepScheduled(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, SWEEP_INTERVAL_MS);
  // Don't keep the event loop (or test runner) alive just for this sweep.
  sweepTimer.unref?.();
}

let warnedMissingRedisInProd = false;

function rateLimitInMemory(key: string, opts: RateLimitOptions): RateLimitResult {
  // Fix (errors.md #C1 residual): this fallback resets on every cold start
  // and is per-instance, so it gives effectively no real protection on a
  // multi-instance/serverless deployment. If we ever reach this path while
  // NODE_ENV=production, that means REDIS_URL was left unset in a deployed
  // environment — log loudly (once) instead of silently degrading, since a
  // missing env var here is a silent brute-force exposure, not just a perf
  // detail.
  if (process.env.NODE_ENV === "production" && !warnedMissingRedisInProd) {
    warnedMissingRedisInProd = true;
    console.error(
      "[rate-limit] CRITICAL: REDIS_URL is not set in a production environment. " +
        "Falling back to a per-instance in-memory limiter that provides NO real " +
        "brute-force protection on serverless/multi-instance deployments. Set " +
        "REDIS_URL immediately."
    );
  }

  ensureSweepScheduled();

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

// ── Redis-backed sliding window ──────────────────────────────────────────────

let _client: Redis | null = null;

function getClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!_client) {
    _client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });
    _client.on("error", (err) => {
      console.error("[rate-limit] Redis connection error:", err.message);
    });
  }
  return _client;
}

/**
 * @returns {ok} false when the key has exceeded the window limit.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const client = getClient();
  if (!client) {
    // No REDIS_URL configured — dev-only fallback, not safe for production.
    return rateLimitInMemory(key, opts);
  }

  try {
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const redisKey = `rl:admin:${key}`;

    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(redisKey, "-inf", windowStart); // prune old entries
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`); // record this attempt
    pipeline.zcard(redisKey); // count in window
    pipeline.pexpire(redisKey, opts.windowMs); // TTL so abandoned keys expire
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    if (count > opts.limit) {
      const oldest = await client.zrange(redisKey, 0, "0", "WITHSCORES");
      const oldestTs = oldest?.[1] ? Number(oldest[1]) : now;
      return { ok: false, retryAfterMs: Math.max(0, oldestTs + opts.windowMs - now) };
    }
    return { ok: true, retryAfterMs: 0 };
  } catch (err) {
    console.error("[rate-limit] Redis error, failing open:", err);
    // Fail open on Redis outages rather than locking every admin out — the
    // LoginAttempt table still records every attempt for forensic review.
    return { ok: true, retryAfterMs: 0 };
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  const client = getClient();
  if (!client) {
    buckets.delete(key);
    return;
  }
  try {
    await client.del(`rl:admin:${key}`);
  } catch (err) {
    console.error("[rate-limit] Redis error clearing key:", err);
  }
}

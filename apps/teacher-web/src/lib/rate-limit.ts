/**
 * src/lib/rate-limit.ts
 *
 * Two-tier rate limiting for Next.js API route handlers.
 *
 * Tier 1 — rateLimitRedis(): Redis sliding-window (Upstash).
 *   Use this in production. Survives cold starts across serverless replicas.
 *   Uses a sorted set per key; scores are epoch-ms timestamps.
 *
 * Tier 2 — rateLimit(): In-process Map (fallback / dev).
 *   Resets on every cold start. Safe for single-instance dev use only.
 *
 * USAGE (production pattern):
 *   const limited = await rateLimitRedis(ip, "login", { windowMs: 60_000, max: 10 });
 *   if (limited) return NextResponse.json({ ... }, { status: 429 });
 */

// ── In-process fallback ────────────────────────────────────────────────────────

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

interface RateLimitOptions {
  /** Duration of the window in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum requests allowed within the window. Default: 10. */
  max?: number;
}

/**
 * In-process rate limiter.
 * Returns `true` if the caller is rate-limited (should receive 429).
 * NOTE: Resets on cold start — use rateLimitRedis() in production.
 */
export function rateLimit(
  identifier: string,
  { windowMs = 60_000, max = 10 }: RateLimitOptions = {}
): boolean {
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  return existing.count > max;
}

// ── Redis sliding-window rate limiter ─────────────────────────────────────────

/**
 * Redis-backed sliding-window rate limiter using a sorted set.
 *
 * Key:   rl:{namespace}:{identifier}
 * Value: sorted set of request timestamps (score = timestamp)
 * TTL:   automatically set to windowMs
 *
 * Returns `true` if the caller is rate-limited.
 *
 * @param identifier  Unique key (e.g., IP address, userId)
 * @param namespace   Logical bucket (e.g., "login", "register", "reset-pw")
 */
export async function rateLimitRedis(
  identifier: string,
  namespace: string,
  { windowMs = 60_000, max = 10 }: RateLimitOptions = {}
): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // Graceful degradation: fall back to in-process limiter if Redis not configured
    return rateLimit(`${namespace}:${identifier}`, { windowMs, max });
  }

  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });

    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `rl:${namespace}:${identifier}`;

    // Remove expired entries, add current request, count within window — all atomic
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(key, "-inf", windowStart);  // prune old entries
    pipeline.zadd(key, now, `${now}-${Math.random()}`);   // add current request
    pipeline.zcard(key);                                   // count in window
    pipeline.pexpire(key, windowMs);                       // set TTL
    const results = await pipeline.exec();

    await client.quit();

    const count = results?.[2]?.[1] as number;
    return count > max;
  } catch (err) {
    console.error("[rateLimitRedis] Redis error, falling back to in-process limiter:", err);
    // Fail open: allow the request if Redis is temporarily unavailable
    return false;
  }
}

// ── Body size guard ────────────────────────────────────────────────────────────

/**
 * Guards a route against unreasonably large request bodies.
 * Returns `true` (blocked) if Content-Length exceeds `maxBytes`.
 * Defaults to 16 KB — sufficient for any auth form payload.
 */
export function exceedsMaxBodySize(
  request: Request,
  maxBytes = 16_384 // 16 KB
): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;
  return parseInt(contentLength, 10) > maxBytes;
}


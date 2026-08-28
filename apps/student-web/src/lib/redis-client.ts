/**
 * src/lib/redis-client.ts — Shared Redis client singleton
 *
 * Provides a single reusable ioredis client for OTP rate limiting,
 * attempt tracking, and cooldown keys. Other modules (redis-session.ts,
 * rate-limit.ts) maintain their own clients for now — this can be
 * consolidated later if desired.
 *
 * Behaviour:
 *  - Lazy-creates on first call to getRedisClient().
 *  - Logs connection errors but never crashes the process.
 *  - Returns null (instead of throwing) if REDIS_URL is not set,
 *    so callers can degrade gracefully.
 */

import Redis from "ioredis";

let _client: Redis | null = null;
let _initialised = false;

/**
 * Returns a connected ioredis client, or `null` if REDIS_URL is missing.
 * Safe to call repeatedly — always returns the same instance.
 */
export function getRedisClient(): Redis | null {
  if (_initialised) return _client;
  _initialised = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[Redis] REDIS_URL is not set — OTP rate limiting will be disabled.");
    return null;
  }

  _client = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      // Exponential backoff capped at 5 seconds
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
  });

  _client.on("connect", () => {
    console.log("[Redis] Connected successfully.");
  });

  _client.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  return _client;
}

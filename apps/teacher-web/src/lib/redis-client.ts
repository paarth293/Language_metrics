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
 *  - Returns null (instead of throwing) if REDIS_URL is not set
 *    or if the connection fails, so callers can degrade gracefully.
 */

import Redis from "ioredis";

let _client: Redis | null = null;
let _initialised = false;
let _connectionOk = false;

/**
 * Returns a connected ioredis client, or `null` if REDIS_URL is missing
 * or the connection has failed. Safe to call repeatedly — always returns
 * the same instance.
 */
export function getRedisClient(): Redis | null {
  if (_initialised) return _connectionOk ? _client : null;
  _initialised = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.warn("[Redis] REDIS_URL is not set — OTP rate limiting will be disabled.");
    return null;
  }

  try {
    _client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 2) {
          _connectionOk = false;
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    _client.on("error", () => {
      // Suppress noisy ioredis error logs — the connection failure
      // is already handled below and callers degrade gracefully.
    });

    // Attempt connection asynchronously. Until this resolves,
    // _connectionOk stays false, so callers get null (safe fallback).
    _client.connect()
      .then(() => _client!.ping())
      .then(() => {
        console.log("[Redis] Connected successfully.");
        _connectionOk = true;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Redis] Could not connect — OTP rate limiting will be disabled: ${msg}`);
        _connectionOk = false;
        try { _client?.disconnect(); } catch { /* ignore */ }
        _client = null;
      });
  } catch (err) {
    console.warn("[Redis] Failed to create client:", err);
    _client = null;
  }

  // On the first call, return null (safe). Once the async connect
  // succeeds, subsequent calls will return the live client.
  return null;
}


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
import { log } from "@repo/logger";
import { reportOpsAlert } from "@repo/logger/ops-alert";

let _client: Redis | null = null;
let _initialised = false;
let _connectionOk = false;

/**
 * Returns a connected ioredis client, or `null` if REDIS_URL is missing
 * or the connection has failed. Safe to call repeatedly — always returns
 * the same instance.
 */
export function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === "production") return getProductionClient();

  if (_initialised) return _connectionOk ? _client : null;
  _initialised = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    log.warn("[Redis] REDIS_URL is not set — OTP rate limiting will be disabled.");
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
        log.info("[Redis] Connected successfully.");
        _connectionOk = true;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn("[Redis] Could not connect — OTP rate limiting will be disabled", { error: msg });
        _connectionOk = false;
        try { _client?.disconnect(); } catch { /* ignore */ }
        _client = null;
      });
  } catch (err) {
    log.warn("[Redis] Failed to create client", { error: err });
    _client = null;
  }

  // On the first call, return null (safe). Once the async connect
  // succeeds, subsequent calls will return the live client.
  return null;
}

/**
 * Production: hand out the client from the first call. ioredis queues
 * commands until the connection is up, so a cold start no longer drops to
 * the per-instance OTP fallback and skips rate limiting, and a failed
 * connect keeps retrying instead of disabling Redis for the instance.
 */
function getProductionClient(): Redis | null {
  if (_client) return _client;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    log.warn("[Redis] REDIS_URL is not set — OTP rate limiting will be disabled.");
    return null;
  }

  _client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  _client.on("error", (err) => {
    log.error("[Redis] Connection error", { error: err.message });
    void reportOpsAlert("redis_error", { scope: "teacher-web redis-client", reason: "Redis connection error.", error: err.message });
  });
  _client.connect().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("[Redis] Initial connect failed, retrying", { error: msg });
  });
  return _client;
}


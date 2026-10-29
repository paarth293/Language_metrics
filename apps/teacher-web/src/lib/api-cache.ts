/**
 * api-cache.ts — Production-ready Redis cache-aside with memory fallback
 *
 * Reduces database load on high-traffic read-heavy endpoints like /discover.
 * Primary storage: Upstash Redis (shared across all serverless instances).
 * Fallback storage: In-memory Map (for dev, test, or when Redis is unreachable).
 *
 * Guarantees:
 *  - Timeouts on Redis reads (250ms) and writes (500ms) prevent stalls.
 *  - Gracefully degrades to memory cache or live computation on any Redis error.
 *  - Responses carry X-Cache: HIT or X-Cache: MISS headers for observability.
 */

import { getRedisClient } from "./redis-client";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune > 300_000) {
    for (const [key, entry] of memoryCache) {
      if (now > entry.expiresAt) memoryCache.delete(key);
    }
    lastPrune = now;
  }
}

/**
 * Get a cached response or compute and cache it.
 *
 * @param key     Cache key (e.g., `v1:discover:lang=spanish`)
 * @param ttlMs   Time-to-live in milliseconds
 * @param fn      Function that produces the Response
 * @returns       Cached or fresh Response
 */
export async function withCache(
  key: string,
  ttlMs: number,
  fn: () => Promise<Response>
): Promise<Response> {
  const redis = getRedisClient();
  const redisKey = `cache:api:v1:${key}`;
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

  // 1. Check Redis if connected
  if (redis) {
    try {
      const cachedStr = await Promise.race([
        redis.get(redisKey),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 250)),
      ]);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr) as { body: string; status: number; headers: Record<string, string> };
        return new Response(cached.body, {
          status: cached.status,
          headers: {
            ...cached.headers,
            "X-Cache": "HIT",
          },
        });
      }
    } catch {
      // Degrade to memory cache
    }
  }

  // 2. Check in-memory fallback
  maybePrune();
  const entry = memoryCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    const cached = entry.data as { body: string; status: number; headers: Record<string, string> };
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...cached.headers,
        "X-Cache": "HIT",
      },
    });
  }

  // 3. Compute fresh response
  const response = await fn();

  // 4. Cache successful responses
  if (response.ok && response.headers.get("x-skip-cache") !== "1") {
    try {
      const body = await response.text();
      const headers = Object.fromEntries(response.headers.entries());

      // Save to memory cache
      memoryCache.set(key, {
        data: { body, status: response.status, headers },
        expiresAt: Date.now() + ttlMs,
      });

      // Save to Redis
      if (redis) {
        void Promise.race([
          redis.set(redisKey, JSON.stringify({ body, status: response.status, headers }), "EX", ttlSeconds),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Redis timeout")), 500)),
        ]).catch(() => {});
      }

      return new Response(body, {
        status: response.status,
        headers: {
          ...headers,
          "X-Cache": "MISS",
        },
      });
    } catch {
      return response;
    }
  }

  return response;
}

/**
 * Invalidate cache entries matching a prefix across both memory and Redis.
 */
export async function invalidateCache(prefix: string) {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const stream = redis.scanStream({
        match: `cache:api:v1:${prefix}*`,
        count: 50,
      });
      stream.on("data", (keys: string[]) => {
        if (keys.length) {
          const pipeline = redis.pipeline();
          keys.forEach((k) => pipeline.del(k));
          void pipeline.exec();
        }
      });
    } catch {
      // Degrade gracefully
    }
  }
}

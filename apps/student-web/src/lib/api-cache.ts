/**
 * api-cache.ts — In-memory response cache for API routes
 *
 * Reduces DB load on high-traffic endpoints like /discover and /dashboard.
 * Uses a simple Map with TTL-based expiration.
 *
 * For production with multiple instances, replace with Redis cache.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// Prune expired entries every 5 minutes
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune > 300_000) {
    for (const [key, entry] of cache) {
      if (now > entry.expiresAt) cache.delete(key);
    }
    lastPrune = now;
  }
}

/**
 * Get a cached response or compute and cache it.
 *
 * @param key     Cache key (e.g., `discover:lang=spanish`)
 * @param ttlMs   Time-to-live in milliseconds (default 60s)
 * @param fn      Function that produces the Response
 * @returns       Cached or fresh Response
 */
export async function withCache(
  key: string,
  ttlMs: number,
  fn: () => Promise<Response>
): Promise<Response> {
  maybePrune();

  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    // Return cached response with header
    const cached = entry.data as { body: string; status: number; headers: Record<string, string> };
    return new Response(cached.body, {
      status: cached.status,
      headers: {
        ...cached.headers,
        "X-Cache": "HIT",
      },
    });
  }

  // Compute fresh response
  const response = await fn();

  // Only cache successful GET responses
  if (response.ok) {
    try {
      const body = await response.text();
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headers[k] = v;
      });

      cache.set(key, {
        data: { body, status: response.status, headers },
        expiresAt: Date.now() + ttlMs,
      });

      return new Response(body, {
        status: response.status,
        headers: {
          ...headers,
          "X-Cache": "MISS",
        },
      });
    } catch {
      // If body consumption fails, return original
      return response;
    }
  }

  return response;
}

/**
 * Invalidate cache entries matching a prefix.
 * Call after write operations (booking, profile update, etc.)
 */
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

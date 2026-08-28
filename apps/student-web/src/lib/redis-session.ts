/**
 * lib/redis-session.ts — Refresh token session store
 *
 * Primary: Redis-backed using sorted sets.
 * Fallback: In-memory Map when Redis is unavailable (dev/local).
 *
 * Refresh tokens are stored:
 *   Key:   rt:{userId}:{sessionId}
 *   Value: JSON metadata (ip, ua, createdAt)
 *   TTL:   7 days
 *
 * Rotation: atomically deletes old key, creates new one.
 * If old key is gone → potential reuse/theft → return false.
 */

import Redis from "ioredis";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let _client: Redis | null = null;
let _redisAvailable: boolean | null = null; // null = untested

// ── In-memory fallback (dev only) ──────────────────────────────────────────
const memStore = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memDel(key: string): void {
  memStore.delete(key);
}

function memScan(pattern: string): string[] {
  // Simple glob-to-regex for rt:{userId}:* pattern
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  const keys: string[] = [];
  for (const k of memStore.keys()) {
    if (regex.test(k)) keys.push(k);
  }
  return keys;
}

// ── Redis client (lazy connect, fail-open) ─────────────────────────────────

function getClient(): Redis | null {
  if (_redisAvailable === false) return null;

  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.warn("[Redis] REDIS_URL not set — using in-memory session store.");
      _redisAvailable = false;
      return null;
    }
    _client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 2) return null; // stop retrying
        return Math.min(times * 200, 1000);
      },
    });
    _client.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
      _redisAvailable = false;
    });
    _client.on("connect", () => {
      _redisAvailable = true;
    });
  }

  return _client;
}

/** Try Redis, fall back to in-memory silently */
async function tryRedis<T>(fn: (client: Redis) => Promise<T>, fallback: () => T): Promise<T> {
  const client = getClient();
  if (!client) return fallback();

  try {
    if (client.status !== "ready" && client.status !== "connect") {
      await client.connect();
    }
    return await fn(client);
  } catch (err) {
    console.error("[Redis] Operation failed, falling back to in-memory:", (err as Error).message);
    _redisAvailable = false;
    return fallback();
  }
}

// ── Key helpers ────────────────────────────────────────────────────────────

function rtKey(userId: string, sessionId: string) {
  return `rt:${userId}:${sessionId}`;
}

function rtPattern(userId: string) {
  return `rt:${userId}:*`;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function storeRefreshSession(
  userId: string,
  sessionId: string,
  meta?: { ip?: string; ua?: string }
): Promise<void> {
  const key = rtKey(userId, sessionId);
  const value = JSON.stringify({ userId, ...meta, createdAt: Date.now() });

  await tryRedis(
    async (client) => { await client.set(key, value, "EX", REFRESH_TTL_SECONDS); },
    () => memSet(key, value, REFRESH_TTL_SECONDS)
  );
}

export async function verifyRefreshSession(
  userId: string,
  sessionId: string
): Promise<{ userId: string; ip?: string; ua?: string; createdAt: number } | null> {
  const key = rtKey(userId, sessionId);

  const raw = await tryRedis(
    (client) => client.get(key),
    () => memGet(key)
  );

  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function rotateRefreshSession(
  userId: string,
  oldSessionId: string,
  newSessionId: string,
  meta?: { ip?: string; ua?: string }
): Promise<boolean> {
  const oldKey = rtKey(userId, oldSessionId);
  const newKey = rtKey(userId, newSessionId);
  const value = JSON.stringify({ userId, ...meta, createdAt: Date.now() });

  return tryRedis(
    async (client) => {
      const oldValue = await client.getdel(oldKey);
      if (!oldValue) return false;
      await client.set(newKey, value, "EX", REFRESH_TTL_SECONDS);
      return true;
    },
    () => {
      // In-memory fallback
      const oldValue = memGet(oldKey);
      if (!oldValue) return false;
      memDel(oldKey);
      memSet(newKey, value, REFRESH_TTL_SECONDS);
      return true;
    }
  );
}

export async function revokeRefreshSession(userId: string, sessionId: string): Promise<void> {
  const key = rtKey(userId, sessionId);

  await tryRedis(
    async (client) => { await client.del(key); },
    () => memDel(key)
  );
}

export async function revokeAllRefreshSessions(userId: string): Promise<void> {
  const pattern = rtPattern(userId);

  await tryRedis(
    async (client) => {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== "0");
    },
    () => {
      for (const key of memScan(pattern)) {
        memDel(key);
      }
    }
  );
}

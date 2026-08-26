/**
 * lib/redis-session.ts — Redis-backed refresh token session store
 *
 * Refresh tokens are stored in Redis:
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

function getClient(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set. Redis is required for refresh token storage.");
    }
    _client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    _client.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
  }
  return _client;
}

function rtKey(userId: string, sessionId: string) {
  return `rt:${userId}:${sessionId}`;
}

function rtPattern(userId: string) {
  return `rt:${userId}:*`;
}

export async function storeRefreshSession(
  userId: string,
  sessionId: string,
  meta?: { ip?: string; ua?: string }
): Promise<void> {
  const client = getClient();
  const value = JSON.stringify({ userId, ...meta, createdAt: Date.now() });
  await client.set(rtKey(userId, sessionId), value, "EX", REFRESH_TTL_SECONDS);
}

export async function verifyRefreshSession(
  userId: string,
  sessionId: string
): Promise<{ userId: string; ip?: string; ua?: string; createdAt: number } | null> {
  const client = getClient();
  const value = await client.get(rtKey(userId, sessionId));
  if (!value) return null;
  try {
    return JSON.parse(value);
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
  const client = getClient();
  const oldKey = rtKey(userId, oldSessionId);
  const newKey = rtKey(userId, newSessionId);
  const value = JSON.stringify({ userId, ...meta, createdAt: Date.now() });

  // GETDEL atomically reads and deletes the old key in one round trip.
  // If it returns null, the key never existed (already rotated or stolen token).
  const oldValue = await client.getdel(oldKey);
  if (!oldValue) {
    // Old session not found — do NOT create new session. Signal theft.
    return false;
  }

  // Old session existed and is now deleted. Create the new one.
  await client.set(newKey, value, "EX", REFRESH_TTL_SECONDS);
  return true;
}

export async function revokeRefreshSession(userId: string, sessionId: string): Promise<void> {
  const client = getClient();
  await client.del(rtKey(userId, sessionId));
}

export async function revokeAllRefreshSessions(userId: string): Promise<void> {
  const client = getClient();
  const pattern = rtPattern(userId);
  let cursor = "0";
  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) await client.del(...keys);
  } while (cursor !== "0");
}

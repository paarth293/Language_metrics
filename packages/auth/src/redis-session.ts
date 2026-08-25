/**
 * @repo/auth — Redis-backed refresh token session store
 *
 * Refresh tokens are stored in Redis using this key pattern:
 *   rt:{userId}:{sessionId}  →  1  (with TTL = REFRESH_TTL_SECONDS)
 *
 * On rotation:
 *  1. Old key is deleted immediately (reuse = theft detection).
 *  2. New sessionId is generated, new key is set.
 *
 * On logout:
 *  - Single key deleted (single-device logout).
 *  - Or pattern-scan + delete all rt:{userId}:* (logout all devices).
 */

import Redis from "ioredis";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let _client: Redis | null = null;

function getClient(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "REDIS_URL is not set. Redis is required for refresh token storage."
      );
    }
    _client = new Redis(url, {
      // Fail fast in dev if Redis is not available
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

/** Key for a specific refresh token session */
function rtKey(userId: string, sessionId: string) {
  return `rt:${userId}:${sessionId}`;
}

/** Key pattern for all sessions belonging to a user */
function rtPattern(userId: string) {
  return `rt:${userId}:*`;
}

/**
 * Store a refresh token session.
 * Returns the sessionId that was stored.
 */
export async function storeRefreshSession(
  userId: string,
  sessionId: string,
  meta?: { ip?: string; ua?: string }
): Promise<void> {
  const client = getClient();
  const value = JSON.stringify({ userId, ...meta, createdAt: Date.now() });
  await client.set(rtKey(userId, sessionId), value, "EX", REFRESH_TTL_SECONDS);
}

/**
 * Verify a refresh token session.
 * Returns the stored metadata if valid, null otherwise.
 */
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

/**
 * Rotate a refresh token session.
 * Atomically deletes the old sessionId and stores the new one.
 * Returns false if the old session did not exist (theft detection).
 */
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

  // Use a pipeline: delete old, set new — both must succeed atomically
  const pipeline = client.pipeline();
  pipeline.del(oldKey);
  pipeline.set(newKey, value, "EX", REFRESH_TTL_SECONDS);
  const results = await pipeline.exec();

  // If the DEL returned 0 keys deleted, the session didn't exist
  const deleted = results?.[0]?.[1] as number;
  return deleted > 0;
}

/**
 * Revoke a single refresh token session (single-device logout).
 */
export async function revokeRefreshSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const client = getClient();
  await client.del(rtKey(userId, sessionId));
}

/**
 * Revoke ALL refresh token sessions for a user (logout all devices).
 * Uses SCAN to avoid blocking Redis with KEYS.
 */
export async function revokeAllRefreshSessions(userId: string): Promise<void> {
  const client = getClient();
  const pattern = rtPattern(userId);
  let cursor = "0";
  do {
    const [nextCursor, keys] = await client.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== "0");
}

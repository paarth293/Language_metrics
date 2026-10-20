import { log } from "@repo/logger";
import { getRedisClient } from './redis-client';

const IDEMPOTENCY_EXPIRY = 60 * 60 * 24 * 7; // 7 days

/**
 * Claim an idempotency key. Returns true the first time a key is seen.
 *
 * The claim and its TTL are one atomic `SET key 1 EX … NX` (#38): SETNX
 * followed by a separate EXPIRE left the key with no TTL if the process died
 * in between, which blocked that key forever.
 *
 * Without Redis this fails open (returns true), so a missing REDIS_URL in
 * development does not block work. A caller that must not run twice has to
 * treat Redis as required.
 */
export async function checkAndSetIdempotency(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    log.warn('Redis not available for idempotency check — failing open', { key });
    return true;
  }

  const result = await redis.set(`idempotency:${key}`, '1', 'EX', IDEMPOTENCY_EXPIRY, 'NX');
  return result === 'OK'; // null means the key was already claimed
}

import { getRedisClient } from './redis-client';

const IDEMPOTENCY_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export async function checkAndSetIdempotency(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // If no Redis, we fail open but log a warning (not ideal for prod, but local dev might lack Redis)
    console.warn('Redis not available for idempotency check');
    return true; 
  }

  const result = await redis.setnx(`idempotency:${key}`, '1');
  if (result === 1) {
    await redis.expire(`idempotency:${key}`, IDEMPOTENCY_EXPIRY);
    return true; // Not seen before
  }
  
  return false; // Already processed
}

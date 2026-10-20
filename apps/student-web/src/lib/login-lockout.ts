import { log } from "@repo/logger";
import { getRedisClient } from "./redis-client";

/**
 * Per-email login limit and temporary lockout (#35).
 *
 * The per-IP limit on the login route does nothing against credential
 * stuffing spread over many addresses, so one account can be guessed at
 * indefinitely. This counts *failures* per email (not attempts, so a person
 * logging in from several devices is never locked out) and refuses further
 * tries once the limit is reached, the way admin login does
 * (apps/admin-panel/src/lib/auth-service.ts).
 */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Per-instance fallback, used only when REDIS_URL is unset. */
const memory = new Map<string, { count: number; resetAt: number }>();

function keyFor(email: string): string {
  return `login-fail:${email.trim().toLowerCase()}`;
}

function memoryEntry(key: string, now: number) {
  const entry = memory.get(key);
  if (!entry || now > entry.resetAt) return null;
  return entry;
}

/** Seconds a locked-out caller should wait, or 0 when not locked out. */
export async function loginLockoutSeconds(email: string): Promise<number> {
  const key = keyFor(email);
  const redis = getRedisClient();
  if (!redis) {
    const entry = memoryEntry(key, Date.now());
    if (!entry || entry.count < MAX_FAILED_LOGINS) return 0;
    return Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
  }
  try {
    const [count, ttl] = await Promise.all([redis.get(key), redis.pttl(key)]);
    if (Number(count) < MAX_FAILED_LOGINS) return 0;
    // -1 = no TTL, -2 = no key; neither should lock anyone out for ever.
    return ttl > 0 ? Math.ceil(ttl / 1000) : 0;
  } catch (err) {
    // A Redis outage must not lock everyone out of their account.
    log.error("[login-lockout] lockout check failed, allowing the attempt", { error: err });
    return 0;
  }
}

/** Count one failed login for this email. */
export async function recordFailedLogin(email: string): Promise<void> {
  const key = keyFor(email);
  const redis = getRedisClient();
  if (!redis) {
    const now = Date.now();
    const entry = memoryEntry(key, now);
    if (entry) entry.count += 1;
    else memory.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
    if (memory.size > 1000) for (const [k, v] of memory) if (now > v.resetAt) memory.delete(k);
    return;
  }
  try {
    const count = await redis.incr(key);
    // Set the window on the first failure; later failures don't extend it.
    if (count === 1) await redis.pexpire(key, LOCKOUT_MS);
  } catch (err) {
    log.error("[login-lockout] could not record a failed login", { error: err });
  }
}

/** Forget this email's failures after a successful login. */
export async function clearFailedLogins(email: string): Promise<void> {
  const key = keyFor(email);
  const redis = getRedisClient();
  if (!redis) {
    memory.delete(key);
    return;
  }
  try {
    await redis.del(key);
  } catch (err) {
    log.error("[login-lockout] could not clear failed logins", { error: err });
  }
}

import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  signSession,
  signRefreshToken,
  verifySession,
} from "./auth";
import type { AdminSessionToken } from "./auth";
import { storeRefreshSession, revokeRefreshSession, revokeAllRefreshSessions } from "./redis-session";

export async function createSession(
  payload: { sub: string; email: string; roleKey: string; isSuperAdmin: boolean },
  ip?: string,
  userAgent?: string
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signSession(payload),
    signRefreshToken(payload.sub, sessionId),
  ]);

  await storeRefreshSession(payload.sub, sessionId, { ip, ua: userAgent });

  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, accessCookieOptions);
  store.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort extraction to revoke in Redis (if available/valid)
    try {
      const { verifyRefreshToken } = await import("./auth");
      const payload = await verifyRefreshToken(refreshToken);
      if (payload?.sub && payload?.sid) {
        await revokeRefreshSession(payload.sub, payload.sid);
      }
    } catch {
      // Ignore
    }
  }

  store.set(ACCESS_COOKIE, "", { ...accessCookieOptions, maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...refreshCookieOptions, maxAge: 0, path: "/api/auth" });
}

export async function readSession(): Promise<AdminSessionToken | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await revokeAllRefreshSessions(userId);
  await destroySession();
}

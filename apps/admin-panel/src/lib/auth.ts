import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Admin session signing. Sessions are short-lived JWTs held in an httpOnly,
// SameSite=strict cookie (never localStorage). The signature is verified on
// every protected request — presence of a cookie alone grants nothing.
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET;
const ISSUER = "lm-admin-panel";
const AUDIENCE = "lm-admin";

export const SESSION_COOKIE = "lm_admin_session";

export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface AdminSessionToken {
  sub: string; // AdminUser.userId (== User.id)
  email: string;
  roleKey: string;
  isSuperAdmin: boolean;
}

export interface VerifiedSession extends AdminSessionToken {
  jti: string;
  iat: number;
  exp: number;
}

if (!JWT_SECRET) {
  // Fail loudly rather than silently shipping an unauthenticated panel.
  throw new Error(
    "JWT_SECRET is not configured. Refusing to start the admin panel without a signing secret."
  );
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET is too short (< 32 chars). Generate a strong one with `openssl rand -base64 64`."
  );
}

export function signSession(payload: AdminSessionToken): string {
  return jwt.sign(
    {
      email: payload.email,
      roleKey: payload.roleKey,
      isSuperAdmin: payload.isSuperAdmin,
    },
    JWT_SECRET as string,
    {
      subject: payload.sub,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: SESSION_TTL_SECONDS,
      jwtid: crypto.randomUUID(),
    }
  );
}

/**
 * Verifies signature, issuer, audience and expiry. Returns null on any failure.
 * This is the ONLY path that turns a cookie into a trusted identity.
 */
export function verifySession(token: string): VerifiedSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as VerifiedSession;
    return decoded;
  } catch {
    return null;
  }
}

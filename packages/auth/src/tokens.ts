/**
 * @repo/auth — RS256 JWT tokens (access + refresh)
 *
 * Access tokens:  15-minute TTL, RS256, contain { sub, role }
 * Refresh tokens: 7-day TTL, RS256, contain { sub, sid (session ID) }
 *
 * RS256 means:
 *  - Only the server (holding the private key) can MINT tokens.
 *  - Any service (holding only the public key) can VERIFY tokens.
 *  - Cross-portal reuse is blocked by the `aud` claim.
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from "jose";

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

// ── TTLs ──────────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;       // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 days

// ── Cookie names ──────────────────────────────────────────────────────────────
export const ACCESS_COOKIE = "lm_access_token";
export const REFRESH_COOKIE = "lm_refresh_token";

// ── Issuers / Audiences (prevent cross-portal token reuse) ───────────────────
const ISSUER = "lm-auth";
const TEACHER_WEB_AUD = "lm-teacher-web";
const ADMIN_AUD = "lm-admin";

// ── Key loading ───────────────────────────────────────────────────────────────

async function getPrivateKey() {
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set");
  // Support both raw PEM and escaped \n
  return importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
}

async function getPublicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY is not set");
  return importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
}

// ── Access token ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  sub: string;  // userId
  role: Role;
}

export async function signAccessToken(
  userId: string,
  role: Role,
  audience: "teacher-web" | "admin" = "teacher-web"
): Promise<string> {
  const key = await getPrivateKey();
  const aud = audience === "admin" ? ADMIN_AUD : TEACHER_WEB_AUD;

  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyAccessToken(
  token: string,
  audience: "teacher-web" | "admin" = "teacher-web"
): Promise<AccessTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const aud = audience === "admin" ? ADMIN_AUD : TEACHER_WEB_AUD;
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: aud,
    });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;  // userId
  sid: string;  // sessionId (the Redis key suffix)
}

export async function signRefreshToken(
  userId: string,
  sessionId: string,
  audience: "teacher-web" | "admin" = "teacher-web"
): Promise<string> {
  const key = await getPrivateKey();
  const aud = audience === "admin" ? ADMIN_AUD : TEACHER_WEB_AUD;

  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyRefreshToken(
  token: string,
  audience: "teacher-web" | "admin" = "teacher-web"
): Promise<RefreshTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const aud = audience === "admin" ? ADMIN_AUD : TEACHER_WEB_AUD;
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: aud,
    });
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,  // lax allows OAuth redirect flow
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/api/auth",          // restrict refresh cookie scope
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

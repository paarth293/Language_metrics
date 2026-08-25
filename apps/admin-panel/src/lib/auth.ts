/**
 * lib/auth.ts — RS256 JWT tokens for Admin Panel (access + refresh)
 *
 * Access tokens:  15-minute TTL, RS256, contain admin identity details
 * Refresh tokens: 7-day TTL, RS256, contain { sub, sid }
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;        // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export const ACCESS_COOKIE = "lm_admin_access_token";
export const REFRESH_COOKIE = "lm_admin_refresh_token";

const ISSUER = "lm-admin-panel";
const AUDIENCE = "lm-admin";

const isProd = process.env.NODE_ENV === "production";

export interface AdminSessionToken extends JWTPayload {
  sub: string;
  email: string;
  roleKey: string;
  isSuperAdmin: boolean;
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  sid: string;
}

async function getPrivateKey() {
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set. Refusing to start.");
  return importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
}

async function getPublicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY is not set. Refusing to start.");
  return importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
}

// ── Access token ─────────────────────────────────────────────────────────────

export async function signSession(payload: {
  sub: string;
  email: string;
  roleKey: string;
  isSuperAdmin: boolean;
}): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({
    email: payload.email,
    roleKey: payload.roleKey,
    isSuperAdmin: payload.isSuperAdmin,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifySession(token: string): Promise<AdminSessionToken | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
    return payload as AdminSessionToken;
  } catch {
    return null;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export async function signRefreshToken(userId: string, sessionId: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

// ── Cookie options ─────────────────────────────────────────────────────────────

export const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

/**
 * lib/tokens.ts — RS256 JWT tokens (access + refresh)
 *
 * Access tokens:  15-minute TTL, RS256, contain { sub, role }
 * Refresh tokens: 7-day TTL, RS256, contain { sub, sid (session ID) }
 */

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from "jose";
import type { Role } from "@/types";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;        // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export const ACCESS_COOKIE = "lm_access_token";
export const REFRESH_COOKIE = "lm_refresh_token";

const ISSUER = "lm-auth";
const AUDIENCE = "lm-teacher-web";

const isProd = process.env.NODE_ENV === "production";

async function getPrivateKey() {
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set");
  return importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
}

async function getPublicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY is not set");
  return importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
}

// ── Access token ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: Role;
}

export async function signAccessToken(userId: string, role: Role): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  sid: string;
}

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
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

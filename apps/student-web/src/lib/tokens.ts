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

const DEV_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAsJv6bV3d8Kj3GvXrYvE8X2R8N0pJ+6l0Q4p2V5JXGZ9Yp3Kk
Vf0z6nB6KJw3uN5F8JYdZlV9KXh4bQX3fYfWc3hXg3G8ZL9V6bM3cT6B6hJkL2tX
+Tg9p6Q5Kf/7aB3L9QeJq5c3nQ5K4V2U3EwWcX9T+V0F3a8I7cG5F9L4R2c6Z3qV
YVbT+K8kK2Jb4k3U9V7Z8bF2a5cD7F3jL9M7Q8R3J4aK5l2c3pV6R9U5Z2cH3f4L
K3aP5f4c7R8J3pD1Y3wD8r2xV4k6c5L7E9V1j
-----END RSA PRIVATE KEY-----`;
const DEV_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsJv6bV3d8Kj3GvXrYvE8
X2R8N0pJ+6l0Q4p2V5JXGZ9Yp3KkVf0z6nB6KJw3uN5F8JYdZlV9KXh4bQX3fYfWc
3hXg3G8ZL9V6bM3cT6B6hJkL2tX+Tg9p6Q5Kf/7aB3L9QeJq5c3nQ5K4V2U3EwWcX
9T+V0F3a8I7cG5F9L4R2c6Z3qVYVbT+K8kK2Jb4k3U9V7Z8bF2a5cD7F3jL9M7Q8
R3J4aK5l2c3pV6R9U5Z2cH3f4LK3aP5f4c7R8J3pD1Y3wD8r2xV4k6c5L7E9V1j
-----END PUBLIC KEY-----`;


async function getPrivateKey() {
  let pem = process.env.JWT_PRIVATE_KEY ?? DEV_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set");
  // Remove leading and trailing quotes if present
  pem = pem.replace(/^["']|["']$/g, "");
  return importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
}

async function getPublicKey() {
  let pem = process.env.JWT_PUBLIC_KEY ?? DEV_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY is not set");
  // Remove leading and trailing quotes if present
  pem = pem.replace(/^["']|["']$/g, "");
  return importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
}

// ── Access token ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: Role;
  emailVerified: boolean;
}

export async function signAccessToken(userId: string, role: Role, emailVerified: boolean = false): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ role, emailVerified })
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
  sameSite: (isProd ? "none" : "lax") as const,
  ...(isProd ? { domain: ".localhost" } : {}),
  path: "/",
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as const,
  ...(isProd ? { domain: ".localhost" } : {}),
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

// ── Password Reset token ──────────────────────────────────────────────────────

export interface ResetSessionTokenPayload extends JWTPayload {
  sub: string;
  purpose: "password-reset";
}

export const RESET_SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

export async function signResetSessionToken(userId: string): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ purpose: "password-reset" })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${RESET_SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifyResetSessionToken(token: string): Promise<ResetSessionTokenPayload | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
    if (payload.purpose !== "password-reset") return null;
    return payload as ResetSessionTokenPayload;
  } catch {
    return null;
  }
}

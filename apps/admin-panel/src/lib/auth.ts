import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const CSRF_COOKIE = "csrf_token";

export type AdminTokenPayload = {
  sub: string;
  role: "ADMIN";
  username?: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a 1-hour admin session JWT (HS256). */
export async function signAdminToken(
  payload: AdminTokenPayload,
  expiresIn = "1h",
): Promise<string> {
  return new SignJWT({ role: payload.role, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

/** Verify signature + expiry; require role ADMIN. Returns null if invalid. */
export async function verifyAdminToken(
  token: string,
): Promise<(JWTPayload & AdminTokenPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.role !== "ADMIN" || typeof payload.sub !== "string") {
      return null;
    }
    return payload as JWTPayload & AdminTokenPayload;
  } catch (err) {
    console.error("JWT Verify Error in Edge:", err);
    return null;
  }
}

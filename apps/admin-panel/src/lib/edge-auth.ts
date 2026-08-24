import { jwtVerify } from "jose";

/**
 * Edge-compatible JWT verification for Next.js middleware.
 * Mirrors the verification logic in auth.ts but uses the `jose` library
 * instead of `jsonwebtoken` (which requires Node.js crypto).
 */

const ISSUER = "lm-admin-panel";
const AUDIENCE = "lm-admin";

export const SESSION_COOKIE = "lm_admin_session";

export async function verifySessionEdge(
  token: string
): Promise<{ valid: true; payload: Record<string, unknown> } | { valid: false }> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return { valid: false };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        issuer: ISSUER,
        audience: AUDIENCE,
      }
    );
    return { valid: true, payload: payload as Record<string, unknown> };
  } catch {
    return { valid: false };
  }
}

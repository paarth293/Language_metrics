/**
 * lib/auth.ts — Cookie-based RS256 auth guard
 *
 * Replaces the old HS256/jsonwebtoken/Bearer-header system entirely.
 *
 * All protected API routes call requireAuth() to verify the lm_access_token
 * httpOnly cookie using the RS256 public key. Never reads Authorization header.
 *
 * Return pattern:
 *   const auth = await requireAuth(request, "TEACHER");
 *   if (auth.error) return auth.error;          // NextResponse 401/403
 *   const userId = auth.user.sub;               // verified user ID
 *   const role   = auth.user.role;              // verified role
 */

import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import type { Role } from "@/types";
import type { AccessTokenPayload } from "@/lib/tokens";

// ── Error codes (machine-readable for clients) ─────────────────────────────

export type AuthErrorCode =
  | "MISSING_TOKEN"       // No access token cookie present
  | "INVALID_TOKEN"       // Token signature bad / expired
  | "INSUFFICIENT_ROLE"   // Token valid but role not allowed
  | "INTERNAL_ERROR";     // Unexpected server error during verification

// ── Result types ───────────────────────────────────────────────────────────

export interface AuthSuccess {
  user: AccessTokenPayload & { sub: string };
  error?: never;
}

export interface AuthFailure {
  user?: never;
  error: NextResponse;
}

// ── Core guard ─────────────────────────────────────────────────────────────

/**
 * Reads and verifies the lm_access_token cookie (RS256).
 * Optionally checks that the user's role is one of `allowedRoles`.
 *
 * @returns { user } on success — { error: NextResponse } on failure.
 *
 * Usage:
 *   const auth = await requireAuth(request, "TEACHER");
 *   if (auth.error) return auth.error;
 *   // auth.user.sub = userId, auth.user.role = "TEACHER"
 */
export async function requireAuth(
  request: Request,
  ...allowedRoles: Role[]
): Promise<AuthSuccess | AuthFailure> {
  try {
    // Read token from httpOnly cookie
    const cookieHeader = request.headers.get("cookie") ?? "";
    const accessToken = parseCookie(cookieHeader, "lm_access_token");

    if (!accessToken) {
      return {
        error: NextResponse.json(
          {
            code: "MISSING_TOKEN",
            message: "Authentication required. Please log in.",
          },
          { status: 401 }
        ),
      };
    }

    // Verify RS256 signature + expiry + issuer + audience
    const payload = await verifyAccessToken(accessToken);

    if (!payload || !payload.sub) {
      return {
        error: NextResponse.json(
          {
            code: "INVALID_TOKEN",
            message: "Your session has expired. Please log in again.",
          },
          { status: 401 }
        ),
      };
    }

    // Role-based access control
    if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
      return {
        error: NextResponse.json(
          {
            code: "INSUFFICIENT_ROLE",
            message: `Access denied. Required role: ${allowedRoles.join(" or ")}.`,
          },
          { status: 403 }
        ),
      };
    }

    return { user: payload as AccessTokenPayload & { sub: string } };
  } catch (err) {
    console.error("[requireAuth] Unexpected error:", err);
    return {
      error: NextResponse.json(
        {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred. Please try again.",
        },
        { status: 500 }
      ),
    };
  }
}

// ── Cookie parser ──────────────────────────────────────────────────────────

/**
 * Parses a single cookie value from a raw Cookie header string.
 */
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

// ── Re-export type for consumers ────────────────────────────────────────────
export type { Role };

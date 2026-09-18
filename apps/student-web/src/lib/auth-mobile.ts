import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "./tokens";
import type { Role } from "@/types";

/**
 * Extracts Bearer token from the incoming HTTP Authorization header.
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

export interface MobileAuthSuccess {
  ok: true;
  user: {
    id: string;
    role: Role;
    emailVerified: boolean;
  };
}

export interface MobileAuthFailure {
  ok: false;
  response: NextResponse;
}

export type MobileAuthResult = MobileAuthSuccess | MobileAuthFailure;

/**
 * Middleware helper for verifying mobile Bearer authentication.
 * Returns either user payload or a pre-configured 401/403 error response.
 */
export async function requireMobileAuth(
  request: NextRequest,
  allowedRoles?: Role[]
): Promise<MobileAuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Missing or malformed Authorization header with Bearer token." },
        { status: 401 }
      ),
    };
  }

  const payload: AccessTokenPayload | null = await verifyAccessToken(token);
  if (!payload || !payload.sub) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Invalid, expired, or untrusted access token." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Forbidden: account role lacks required permissions." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: payload.sub,
      role: payload.role,
      emailVerified: payload.emailVerified,
    },
  };
}

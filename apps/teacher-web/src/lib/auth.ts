import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { Role, TokenPayload } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET;

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured. Refusing to start without a signing secret."
    );
  }
  if (JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET is too short (< 32 chars). Generate a strong one with `openssl rand -base64 64`."
    );
  }
  return JWT_SECRET;
}

export interface ExtendedTokenPayload extends TokenPayload {
  emailVerified?: boolean;
}

export function signToken(userId: string, role: Role, emailVerified: boolean = true): string {
  const secret = getSecret();
  return jwt.sign({ userId, role, emailVerified }, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string): ExtendedTokenPayload | null {
  try {
    const secret = getSecret();
    const decoded = jwt.verify(token, secret) as ExtendedTokenPayload;
    return { userId: decoded.userId, role: decoded.role, emailVerified: decoded.emailVerified };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the Bearer JWT from a request's Authorization header.
 * Returns the decoded payload, or null if missing/invalid.
 */
export function getAuthUser(req: Request): ExtendedTokenPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}

import { db } from "@/lib/db";

/**
 * Guards a Route Handler by role. Returns either:
 *  - { user } when authorized, or
 *  - { response } (a ready-to-return 401/403) when not.
 */
export async function requireRole(
  req: Request,
  ...allowedRoles: Role[]
): Promise<{ user: ExtendedTokenPayload; response?: never } | { user?: never; response: NextResponse }> {
  const user = getAuthUser(req);

  if (!user) {
    return {
      response: NextResponse.json(
        { message: "Not authorized — no valid token provided." },
        { status: 401 }
      ),
    };
  }

  // Enforce Email Verification
  let isVerified = user.emailVerified;
  
  // Legacy token fallback: if emailVerified is not in the token, check the database once.
  if (isVerified === undefined) {
    const dbUser = await db.user.findUnique({ where: { id: user.userId }, select: { emailVerified: true } });
    isVerified = !!dbUser?.emailVerified;
  }

  if (!isVerified) {
    return {
      response: NextResponse.json(
        { message: "Not authorized — email not verified." },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      response: NextResponse.json(
        { message: `Access denied — required role: ${allowedRoles.join(" or ")}.` },
        { status: 403 }
      ),
    };
  }

  return { user };
}

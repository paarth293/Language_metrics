import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import type { Role, TokenPayload } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set. Auth will not work until it is configured in .env");
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, JWT_SECRET as string, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the Bearer JWT from a request's Authorization header.
 * Returns the decoded payload, or null if missing/invalid.
 */
export function getAuthUser(req: Request): TokenPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}

/**
 * Guards a Route Handler by role. Returns either:
 *  - { user } when authorized, or
 *  - { response } (a ready-to-return 401/403) when not.
 */
export function requireRole(
  req: Request,
  ...allowedRoles: Role[]
): { user: TokenPayload; response?: never } | { user?: never; response: NextResponse } {
  const user = getAuthUser(req);

  if (!user) {
    return {
      response: NextResponse.json(
        { message: "Not authorized — no valid token provided." },
        { status: 401 }
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

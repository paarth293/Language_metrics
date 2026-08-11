import { NextResponse } from "next/server";
import { verifyToken, type Role, type TokenPayload } from "./jwt";

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

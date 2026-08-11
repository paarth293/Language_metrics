import jwt from "jsonwebtoken";

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface TokenPayload {
  userId: string;
  role: Role;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail fast at import time in a server context if misconfigured.
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

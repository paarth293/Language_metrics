export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TokenPayload {
  userId: string;
  role: Role;
}

// Matches Prisma's `VerificationStatus` enum in packages/database/prisma/schema.prisma
// exactly (including case) — this is what the API actually returns, so this type
// must never drift from the schema.
export type VerificationStatus =
  | "PENDING"
  | "INTERVIEW_SCHEDULED"
  | "APPROVED"
  | "REJECTED";

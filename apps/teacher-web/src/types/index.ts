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

export type VerificationStatus = "pending" | "approved" | "rejected";

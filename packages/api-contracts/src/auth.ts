import { z } from "zod";

export const UserRoleSchema = z.enum(["STUDENT", "TEACHER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const MobileLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});
export type MobileLoginRequest = z.infer<typeof MobileLoginRequestSchema>;

export const AuthUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
  avatarUrl: z.string().nullable().optional(),
});
export type AuthUserSummary = z.infer<typeof AuthUserSummarySchema>;

export const MobileTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer").default("Bearer"),
  expiresIn: z.number().int().positive(),
  user: AuthUserSummarySchema,
});
export type MobileTokenResponse = z.infer<typeof MobileTokenResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const MobileLogoutRequestSchema = z.object({
  refreshToken: z.string().optional(),
});
export type MobileLogoutRequest = z.infer<typeof MobileLogoutRequestSchema>;

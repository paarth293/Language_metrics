import { z } from "zod";

export const LiveKitTokenRequestSchema = z.object({
  sessionId: z.string().min(1),
  bookingId: z.string().min(1),
});
export type LiveKitTokenRequest = z.infer<typeof LiveKitTokenRequestSchema>;

export const LiveKitTokenResponseSchema = z.object({
  token: z.string().min(1),
  serverUrl: z.string().url(),
  roomName: z.string().min(1),
  participantIdentity: z.string(),
  participantName: z.string(),
  expiresAt: z.string().datetime(),
});
export type LiveKitTokenResponse = z.infer<typeof LiveKitTokenResponseSchema>;

export const LiveSessionStatusSchema = z.object({
  sessionId: z.string(),
  roomActive: z.boolean(),
  numParticipants: z.number().int().min(0),
  joinedAt: z.string().datetime().nullable().optional(),
});
export type LiveSessionStatus = z.infer<typeof LiveSessionStatusSchema>;

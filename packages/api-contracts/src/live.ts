import { z } from "zod";

/**
 * Live class contracts.
 *
 * Shared by student-web, teacher-web, admin-panel and the Expo app so the
 * four clients cannot drift apart. The previous version described a token
 * response no route actually returned.
 */

export const QualityProfileSchema = z.enum(["audio-only", "low", "standard", "high"]);
export type QualityProfile = z.infer<typeof QualityProfileSchema>;

export const LiveKitTokenRequestSchema = z.object({
  classSessionId: z.string().min(1),
  /** Client preference. The server may return a lower one under budget pressure. */
  profile: QualityProfileSchema.optional(),
});
export type LiveKitTokenRequest = z.infer<typeof LiveKitTokenRequestSchema>;

export const LiveKitTokenResponseSchema = z.object({
  token: z.string().min(1),
  serverUrl: z.string().min(1),
  roomName: z.string().min(1),
  participantIdentity: z.string(),
  participantName: z.string(),
  expiresAt: z.string(),
  role: z.enum(["TEACHER", "STUDENT", "ADMIN"]),
  /** The profile actually granted — may differ from the one requested. */
  profile: QualityProfileSchema,
  otherPartyName: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  /** Hard cutoff; the client shows a countdown and disconnects here. */
  hardEndsAt: z.string(),
  coinsPerMinute: z.number().int().min(0),
  heldCoins: z.number().int().min(0),
  recordingEnabled: z.boolean(),
});
export type LiveKitTokenResponse = z.infer<typeof LiveKitTokenResponseSchema>;

export const LiveKitTokenErrorSchema = z.object({
  code: z.enum([
    "SESSION_NOT_FOUND",
    "NOT_A_PARTICIPANT",
    "SESSION_CANCELLED",
    "SESSION_COMPLETED",
    "TOO_EARLY",
    "TOO_LATE",
    "BOOKING_NOT_CONFIRMED",
    "BUDGET_EXCEEDED",
    "NOT_CONFIGURED",
  ]),
  message: z.string(),
  joinOpensAt: z.string().optional(),
});
export type LiveKitTokenError = z.infer<typeof LiveKitTokenErrorSchema>;

export const LiveSessionStatusSchema = z.object({
  classSessionId: z.string(),
  roomActive: z.boolean(),
  numParticipants: z.number().int().min(0),
  teacherPresent: z.boolean(),
  studentPresent: z.boolean(),
  status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  recordingStatus: z.enum([
    "NONE",
    "REQUESTED",
    "RECORDING",
    "PROCESSING",
    "AVAILABLE",
    "FAILED",
  ]),
});
export type LiveSessionStatus = z.infer<typeof LiveSessionStatusSchema>;

/** Live meter shown to the student during class — what they are being charged. */
export const LiveMeterSchema = z.object({
  classSessionId: z.string(),
  /** Seconds the student and teacher have both been connected so far. */
  billableSeconds: z.number().int().min(0),
  billableMinutes: z.number().int().min(0),
  coinsPerMinute: z.number().int().min(0),
  /** Coins consumed so far. Never exceeds heldCoins. */
  coinsSoFar: z.number().int().min(0),
  heldCoins: z.number().int().min(0),
  /** Coins that would be returned if the class ended right now. */
  projectedRefund: z.number().int().min(0),
  settled: z.boolean(),
});
export type LiveMeter = z.infer<typeof LiveMeterSchema>;

export const StartRecordingRequestSchema = z.object({
  classSessionId: z.string().min(1),
  mode: z.enum(["audio", "video"]).default("audio"),
});
export type StartRecordingRequest = z.infer<typeof StartRecordingRequestSchema>;

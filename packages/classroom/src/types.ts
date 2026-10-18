import type { QualityProfileId } from "@repo/livekit";

export interface TokenResponse {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: "TEACHER" | "STUDENT" | "ADMIN";
  profile: QualityProfileId;
  otherPartyName: string;
  scheduledStart: string;
  scheduledEnd: string;
  hardEndsAt: string;
  coinsPerMinute: number;
  heldCoins: number;
  recordingEnabled: boolean;
}

export interface TokenError {
  code: string;
  message: string;
  joinOpensAt?: string;
}

export interface Meter {
  billableMinutes: number;
  coinsPerMinute: number;
  coinsSoFar: number;
  heldCoins: number;
  projectedRefund: number;
  settled: boolean;
}

export interface ChatEntry {
  id: string;
  sender: string;
  text: string;
  at: number;
  self: boolean;
}

export interface LiveClassroomProps {
  classSessionId: string;
  /** Where the Back and Leave buttons go. */
  exitHref: string;
  /** Optional: skip the prejoin screen (used by the admin observer view). */
  autoJoin?: boolean;
}

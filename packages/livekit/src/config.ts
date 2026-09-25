/**
 * @repo/livekit — configuration & cost policy
 *
 * Single source of truth for every LiveKit setting in the monorepo. Nothing
 * else in the codebase should read process.env.LIVEKIT_*.
 *
 * Why this file exists
 * -------------------
 * LiveKit Cloud bills on two axes and both of them are controlled here:
 *
 *   1. Connection minutes  — one minute per *participant* per wall-clock
 *      minute connected. A 1:1 class therefore burns 2 connection minutes
 *      for every minute of class. Controlled by `joinWindow`, `tokenTtl`,
 *      `emptyTimeoutSeconds` and `departureTimeoutSeconds` below.
 *   2. Downstream bandwidth — bytes the SFU sends *to* participants.
 *      Controlled by the quality profiles below.
 *
 * Changing a number in this file changes the bill. Nothing here is cosmetic.
 */

export type LiveKitDeployment = "cloud" | "self-hosted";

/** Quality profile ids, cheapest first. */
export type QualityProfileId = "audio-only" | "low" | "standard" | "high";

export interface QualityProfile {
  id: QualityProfileId;
  label: string;
  /** Capture resolution requested from the camera. */
  width: number;
  height: number;
  frameRate: number;
  /** Target bitrate for the primary video layer, bits per second. */
  videoBitrate: number;
  /** Simulcast layers published alongside the primary layer. */
  simulcastLayers: Array<{ width: number; height: number; bitrate: number; frameRate: number }>;
  /** Audio bitrate, bits per second. */
  audioBitrate: number;
  /** When true no camera track is published at all. */
  audioOnly: boolean;
}

/**
 * Profiles tuned for 1:1 language tuition, not for a webinar.
 *
 * A language class is an *audio-first* product: the pedagogical value is in
 * pronunciation and conversation. Video is there for rapport and mouth shape.
 * 360p is genuinely enough, and it costs roughly a quarter of what 720p does.
 */
export const QUALITY_PROFILES: Record<QualityProfileId, QualityProfile> = {
  "audio-only": {
    id: "audio-only",
    label: "Audio only",
    width: 0,
    height: 0,
    frameRate: 0,
    videoBitrate: 0,
    simulcastLayers: [],
    audioBitrate: 24_000,
    audioOnly: true,
  },
  low: {
    id: "low",
    label: "Data saver (360p)",
    width: 640,
    height: 360,
    frameRate: 20,
    videoBitrate: 300_000,
    simulcastLayers: [{ width: 320, height: 180, bitrate: 120_000, frameRate: 15 }],
    audioBitrate: 24_000,
    audioOnly: false,
  },
  standard: {
    id: "standard",
    label: "Standard (540p)",
    width: 960,
    height: 540,
    frameRate: 24,
    videoBitrate: 700_000,
    simulcastLayers: [
      { width: 640, height: 360, bitrate: 300_000, frameRate: 20 },
      { width: 320, height: 180, bitrate: 120_000, frameRate: 15 },
    ],
    audioBitrate: 32_000,
    audioOnly: false,
  },
  high: {
    id: "high",
    label: "High (720p)",
    width: 1280,
    height: 720,
    frameRate: 30,
    videoBitrate: 1_700_000,
    simulcastLayers: [
      { width: 640, height: 360, bitrate: 400_000, frameRate: 20 },
      { width: 320, height: 180, bitrate: 150_000, frameRate: 15 },
    ],
    audioBitrate: 32_000,
    audioOnly: false,
  },
};

/**
 * The profile a class starts at. Deliberately `low`.
 *
 * Participants can raise it in-call; the client drops back down automatically
 * when the connection degrades. Starting low and letting people opt up costs
 * far less than starting high and hoping they opt down, because almost nobody
 * opts down.
 */
export const DEFAULT_QUALITY_PROFILE: QualityProfileId =
  (process.env.LIVEKIT_DEFAULT_QUALITY as QualityProfileId) || "low";

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  /** wss:// URL handed to browser clients. */
  wsUrl: string;
  /** https:// URL used by server-side REST calls (RoomService, Egress). */
  httpUrl: string;
  deployment: LiveKitDeployment;
  /** Shared secret LiveKit signs webhooks with — always the API secret. */
  webhookEnabled: boolean;
  /** Minutes before scheduledStart that a participant may join. */
  joinWindowMinutes: number;
  /** Minutes after scheduledEnd that a participant may still be connected. */
  graceMinutes: number;
  /** Room is torn down this many seconds after the last participant leaves. */
  emptyTimeoutSeconds: number;
  /** A participant that drops is considered gone after this many seconds. */
  departureTimeoutSeconds: number;
  /** Hard ceiling on participants in a class room. */
  maxParticipants: number;
  /** Monthly LiveKit spend ceiling in USD. Rooms stop opening above it. */
  monthlyBudgetUsd: number;
  /** Monthly connection-minute allowance included in the plan. */
  includedConnectionMinutes: number;
  /** Monthly downstream GB allowance included in the plan. */
  includedDownstreamGb: number;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseUrls(raw: string): { wsUrl: string; httpUrl: string } {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return { wsUrl: "", httpUrl: "" };
  if (trimmed.startsWith("wss://")) {
    return { wsUrl: trimmed, httpUrl: `https://${trimmed.slice(6)}` };
  }
  if (trimmed.startsWith("ws://")) {
    return { wsUrl: trimmed, httpUrl: `http://${trimmed.slice(5)}` };
  }
  if (trimmed.startsWith("https://")) {
    return { wsUrl: `wss://${trimmed.slice(8)}`, httpUrl: trimmed };
  }
  if (trimmed.startsWith("http://")) {
    return { wsUrl: `ws://${trimmed.slice(7)}`, httpUrl: trimmed };
  }
  return { wsUrl: `wss://${trimmed}`, httpUrl: `https://${trimmed}` };
}

let cached: LiveKitConfig | null = null;

export function getLiveKitConfig(): LiveKitConfig {
  if (cached) return cached;

  const apiKey = (process.env.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET ?? "").trim();
  const rawUrl = (process.env.LIVEKIT_WS_URL ?? process.env.LIVEKIT_URL ?? "").trim();
  const { wsUrl, httpUrl } = normaliseUrls(rawUrl);

  cached = {
    apiKey,
    apiSecret,
    wsUrl,
    httpUrl,
    deployment: wsUrl.includes(".livekit.cloud") ? "cloud" : "self-hosted",
    webhookEnabled: Boolean(apiKey && apiSecret),
    joinWindowMinutes: num("LIVEKIT_JOIN_WINDOW_MINUTES", 10),
    graceMinutes: num("LIVEKIT_GRACE_MINUTES", 10),
    emptyTimeoutSeconds: num("LIVEKIT_EMPTY_TIMEOUT_SECONDS", 120),
    departureTimeoutSeconds: num("LIVEKIT_DEPARTURE_TIMEOUT_SECONDS", 20),
    maxParticipants: num("LIVEKIT_MAX_PARTICIPANTS", 4),
    monthlyBudgetUsd: num("LIVEKIT_MONTHLY_BUDGET_USD", 25),
    includedConnectionMinutes: num("LIVEKIT_INCLUDED_CONNECTION_MINUTES", 5000),
    includedDownstreamGb: num("LIVEKIT_INCLUDED_DOWNSTREAM_GB", 50),
  };
  return cached;
}

/** Test seam — clears the memoised config. */
export function resetLiveKitConfigCache(): void {
  cached = null;
}

/**
 * True only when every credential needed to mint a real token is present.
 *
 * Callers must branch on this rather than letting the SDK throw, because a
 * fresh checkout has no credentials and local development must still work.
 */
export function isLiveKitConfigured(): boolean {
  const c = getLiveKitConfig();
  return Boolean(c.apiKey && c.apiSecret && c.wsUrl);
}

/** Throws a readable error instead of an SDK stack trace. */
export function assertLiveKitConfigured(): LiveKitConfig {
  const c = getLiveKitConfig();
  const missing: string[] = [];
  if (!c.apiKey) missing.push("LIVEKIT_API_KEY");
  if (!c.apiSecret) missing.push("LIVEKIT_API_SECRET");
  if (!c.wsUrl) missing.push("LIVEKIT_WS_URL");
  if (missing.length > 0) {
    throw new Error(
      `LiveKit is not configured. Missing environment variable(s): ${missing.join(", ")}.`
    );
  }
  return c;
}

/** Deterministic room name for a class session. Never derive this ad hoc. */
export function roomNameForSession(classSessionId: string): string {
  return `class-${classSessionId}`;
}

/** Inverse of roomNameForSession. Returns null for rooms we do not own. */
export function sessionIdFromRoomName(roomName: string): string | null {
  return roomName.startsWith("class-") ? roomName.slice("class-".length) : null;
}

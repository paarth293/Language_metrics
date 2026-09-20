/**
 * @repo/livekit/server — server-only LiveKit operations.
 *
 * Never import this from a client component; it holds the API secret.
 */

import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  RoomServiceClient,
  WebhookReceiver,
  type ParticipantInfo,
  type Room,
  type VideoGrant,
  type WebhookEvent,
} from "livekit-server-sdk";

import {
  assertLiveKitConfigured,
  getLiveKitConfig,
  roomNameForSession,
  type QualityProfileId,
} from "./config";

export type ClassRole = "TEACHER" | "STUDENT" | "ADMIN";

/**
 * Metadata carried on the LiveKit participant.
 *
 * The webhook handler reads this back to decide who to bill, so it must stay
 * stable. Identity alone is not enough: identity is the user id, and a user
 * id does not tell us which side of the class they are on.
 */
export interface ParticipantMetadata {
  role: ClassRole;
  userId: string;
  displayName: string;
  classSessionId: string;
  bookingId: string;
  /** Quality profile the server granted for this join. */
  profile: QualityProfileId;
}

export interface MintTokenOptions {
  classSessionId: string;
  bookingId: string;
  userId: string;
  displayName: string;
  role: ClassRole;
  profile: QualityProfileId;
  /** Token lifetime in seconds. Clamped to [5 min, 4 h]. */
  ttlSeconds: number;
  /** Admins join invisibly to monitor without appearing in the class. */
  hidden?: boolean;
  /** Screen sharing is teacher-only by default. */
  allowScreenShare?: boolean;
}

export interface MintedToken {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  expiresAt: string;
}

const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 4 * 60 * 60;

/**
 * Mint a room-scoped, role-scoped access token.
 *
 * Two properties matter here and both are cost/security controls:
 *
 *   - The grant names exactly one room. A token for class A cannot open
 *     class B, so a leaked token cannot be used to burn minutes elsewhere.
 *   - The TTL is bounded by the class's own end time. Once the class is over
 *     the token stops working, which means a forgotten browser tab cannot
 *     silently reconnect for hours and bill us for it.
 */
export async function mintClassToken(opts: MintTokenOptions): Promise<MintedToken> {
  const config = assertLiveKitConfigured();
  const roomName = roomNameForSession(opts.classSessionId);
  const ttl = Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(opts.ttlSeconds)));

  const metadata: ParticipantMetadata = {
    role: opts.role,
    userId: opts.userId,
    displayName: opts.displayName,
    classSessionId: opts.classSessionId,
    bookingId: opts.bookingId,
    profile: opts.profile,
  };

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: opts.userId,
    name: opts.displayName,
    ttl,
    metadata: JSON.stringify(metadata),
  });

  const isTeacher = opts.role === "TEACHER";
  const isAdmin = opts.role === "ADMIN";
  const allowScreenShare = opts.allowScreenShare ?? isTeacher;

  const sources: VideoGrant["canPublishSources"] = isAdmin
    ? []
    : allowScreenShare
      ? ["camera", "microphone", "screen_share", "screen_share_audio"]
      : ["camera", "microphone"];

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: !isAdmin,
    canPublishData: true,
    canPublishSources: sources,
    canUpdateOwnMetadata: true,
    // Teachers moderate (mute, remove). Admins observe without appearing.
    roomAdmin: isTeacher || isAdmin,
    roomRecord: isTeacher || isAdmin,
    hidden: opts.hidden ?? isAdmin,
  };

  at.addGrant(grant);

  return {
    token: await at.toJwt(),
    serverUrl: config.wsUrl,
    roomName,
    participantIdentity: opts.userId,
    participantName: opts.displayName,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}

let roomService: RoomServiceClient | null = null;

export function getRoomService(): RoomServiceClient {
  const config = assertLiveKitConfigured();
  if (!roomService) {
    roomService = new RoomServiceClient(config.httpUrl, config.apiKey, config.apiSecret);
  }
  return roomService;
}

let egressClient: EgressClient | null = null;

export function getEgressClient(): EgressClient {
  const config = assertLiveKitConfigured();
  if (!egressClient) {
    egressClient = new EgressClient(config.httpUrl, config.apiKey, config.apiSecret);
  }
  return egressClient;
}

/**
 * Create the room ahead of the first join, with timeouts that stop it
 * lingering.
 *
 * `emptyTimeout` is the important one. Left at LiveKit's default (5 min) an
 * abandoned room keeps an entry alive long after everyone has gone. Two
 * minutes is enough to survive a reconnect and short enough not to matter.
 */
export async function ensureClassRoom(params: {
  classSessionId: string;
  maxParticipants?: number;
}): Promise<Room> {
  const config = getLiveKitConfig();
  const svc = getRoomService();
  const name = roomNameForSession(params.classSessionId);

  const existing = await svc.listRooms([name]);
  if (existing.length > 0 && existing[0]) return existing[0];

  return svc.createRoom({
    name,
    emptyTimeout: config.emptyTimeoutSeconds,
    departureTimeout: config.departureTimeoutSeconds,
    maxParticipants: params.maxParticipants ?? config.maxParticipants,
    metadata: JSON.stringify({ classSessionId: params.classSessionId }),
  });
}

export async function listClassParticipants(classSessionId: string): Promise<ParticipantInfo[]> {
  try {
    return await getRoomService().listParticipants(roomNameForSession(classSessionId));
  } catch {
    // listParticipants throws when the room does not exist, which is the
    // normal state for a class nobody has joined yet.
    return [];
  }
}

export async function listActiveClassRooms(): Promise<Room[]> {
  const rooms = await getRoomService().listRooms();
  return rooms.filter((r) => r.name.startsWith("class-"));
}

/** Force-end a class. Used by the admin panel and by the overrun sweeper. */
export async function endClassRoom(classSessionId: string): Promise<void> {
  try {
    await getRoomService().deleteRoom(roomNameForSession(classSessionId));
  } catch (err) {
    // Already gone is success as far as the caller is concerned.
    if (!/not found|does not exist/i.test(String(err))) throw err;
  }
}

export async function removeParticipant(
  classSessionId: string,
  identity: string
): Promise<void> {
  await getRoomService().removeParticipant(roomNameForSession(classSessionId), identity);
}

export async function muteParticipantTrack(
  classSessionId: string,
  identity: string,
  trackSid: string,
  muted: boolean
): Promise<void> {
  await getRoomService().mutePublishedTrack(
    roomNameForSession(classSessionId),
    identity,
    trackSid,
    muted
  );
}

// ── Recording (Egress) ──────────────────────────────────────────────────────

export type RecordingMode = "audio" | "video";

export interface StartRecordingOptions {
  classSessionId: string;
  mode: RecordingMode;
  /** Object key inside the bucket, without extension. */
  filenamePrefix: string;
}

export interface StartRecordingResult {
  egressId: string;
  filepath: string;
}

function s3UploadFromEnv() {
  const bucket = process.env.LIVEKIT_RECORDING_BUCKET ?? process.env.S3_BUCKET_NAME ?? "";
  const accessKey = process.env.LIVEKIT_RECORDING_ACCESS_KEY ?? process.env.S3_ACCESS_KEY_ID ?? "";
  const secret = process.env.LIVEKIT_RECORDING_SECRET_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? "";
  const region = process.env.LIVEKIT_RECORDING_REGION ?? process.env.S3_REGION ?? "auto";
  const endpoint = process.env.LIVEKIT_RECORDING_ENDPOINT ?? process.env.S3_ENDPOINT ?? "";

  if (!bucket || !accessKey || !secret) {
    throw new Error(
      "Recording storage is not configured. Set LIVEKIT_RECORDING_BUCKET, " +
        "LIVEKIT_RECORDING_ACCESS_KEY and LIVEKIT_RECORDING_SECRET_KEY."
    );
  }

  return {
    bucket,
    accessKey,
    secret,
    region,
    // Supabase Storage and other S3-compatible backends need path-style URLs.
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  };
}

/**
 * Start a composite recording.
 *
 * Audio-only is the default everywhere in this codebase and that is a cost
 * decision worth stating plainly: LiveKit charges $0.02/min to transcode
 * composite video and $0.005/min for audio. For a language lesson the audio
 * IS the artefact — students re-listen to pronunciation, they do not re-watch
 * a talking head. Four times cheaper for approximately none of the value.
 */
export async function startClassRecording(
  opts: StartRecordingOptions
): Promise<StartRecordingResult> {
  const roomName = roomNameForSession(opts.classSessionId);
  const audioOnly = opts.mode === "audio";
  const extension = audioOnly ? "ogg" : "mp4";
  const filepath = `${opts.filenamePrefix}.${extension}`;

  const output = new EncodedFileOutput({
    fileType: audioOnly ? EncodedFileType.OGG : EncodedFileType.MP4,
    filepath,
    output: { case: "s3", value: s3UploadFromEnv() },
  });

  const info = await getEgressClient().startRoomCompositeEgress(
    roomName,
    { file: output },
    {
      layout: "speaker",
      audioOnly,
      // 360p30 keeps the transcode cheap and matches what we publish.
      encodingOptions: audioOnly ? undefined : EncodingOptionsPreset.H264_720P_30,
    }
  );

  return { egressId: info.egressId, filepath };
}

export async function stopClassRecording(egressId: string): Promise<void> {
  try {
    await getEgressClient().stopEgress(egressId);
  } catch (err) {
    if (!/not found|already ended|EGRESS_COMPLETE/i.test(String(err))) throw err;
  }
}

// ── Webhooks ────────────────────────────────────────────────────────────────

let webhookReceiver: WebhookReceiver | null = null;

/**
 * Verify a LiveKit webhook and return the typed event.
 *
 * The body MUST be the raw request text. Parsing it to JSON first and
 * re-stringifying breaks the signature, which is the single most common way
 * this integration is gotten wrong.
 */
export async function verifyWebhook(
  rawBody: string,
  authHeader: string | null
): Promise<WebhookEvent> {
  const config = assertLiveKitConfigured();
  if (!authHeader) throw new Error("Missing Authorization header on LiveKit webhook.");
  if (!webhookReceiver) {
    webhookReceiver = new WebhookReceiver(config.apiKey, config.apiSecret);
  }
  return webhookReceiver.receive(rawBody, authHeader);
}

/** Parse participant metadata, tolerating participants we did not create. */
export function parseParticipantMetadata(raw?: string): ParticipantMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ParticipantMetadata>;
    if (!parsed.role || !parsed.userId) return null;
    return parsed as ParticipantMetadata;
  } catch {
    return null;
  }
}

export type { WebhookEvent, Room, ParticipantInfo };

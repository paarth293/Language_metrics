/**
 * LiveKit integration service for video sessions.
 *
 * Configuration:
 *   LIVEKIT_API_KEY    — your LiveKit API key
 *   LIVEKIT_API_SECRET — your LiveKit API secret
 *   LIVEKIT_WS_URL     — WebSocket URL (e.g. wss://your-instance.livekit.cloud)
 *
 * To activate:
 *   1. Install: npm install livekit-server-sdk
 *   2. Set environment variables
 *   3. Restart the dev server
 *
 * Until then the service returns mock tokens for local development.
 */

const API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
const WS_URL = process.env.LIVEKIT_WS_URL ?? "";

const isConfigured = Boolean(API_KEY && API_SECRET && WS_URL);

/**
 * Generate a LiveKit access token for a participant joining a room.
 *
 * @param roomName  — unique room name (we use the booking ID)
 * @param identity  — participant identity (user ID)
 * @param name      — display name
 * @param role      — "teacher" or "student" (controls permissions)
 * @param ttl       — token lifetime in seconds (default 4 hours)
 */
export async function generateLiveKitToken(params: {
  roomName: string;
  identity: string;
  name: string;
  role: "teacher" | "student";
  ttl?: number;
}): Promise<{ token: string; wsUrl: string }> {
  const { roomName, identity, name, role, ttl = 4 * 60 * 60 } = params;

  if (!isConfigured) {
    // Return a mock token for local development
    return {
      token: `mock_token_${identity}_${roomName}_${Date.now()}`,
      wsUrl: "ws://localhost:7880",
    };
  }

  // Dynamic import — livekit-server-sdk is an optional dependency
  // Install it with: npm install livekit-server-sdk
  const { AccessToken } = await Function('return import("livekit-server-sdk")')() as { AccessToken: new (...args: unknown[]) => unknown };

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity,
    name,
    ttl,
  });

  // Teachers get moderator permissions; students get subscriber
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    // Only teachers can manage (mute others, etc.)
    ...(role === "teacher" ? { roomAdmin: true, roomCreate: true } : {}),
  });

  const token = await at.toJwt();

  return { token, wsUrl: WS_URL };
}

/**
 * Get the LiveKit room URL for embedding in an iframe or client SDK.
 */
export function getLiveKitWsUrl(): string {
  return WS_URL || "ws://localhost:7880";
}

/**
 * Check if LiveKit is properly configured.
 */
export function isLiveKitConfigured(): boolean {
  return isConfigured;
}

/**
 * DEPRECATED — use @repo/livekit instead.
 *
 * The previous implementation in this file:
 *   - returned `mock_token_${identity}_${roomName}_${Date.now()}` whenever
 *     LIVEKIT_* env vars were unset, so an unconfigured deployment produced
 *     tokens that looked fine and failed at the SFU;
 *   - loaded the SDK via `Function('return import("livekit-server-sdk")')()`
 *     to dodge a missing dependency, which defeats bundling, type checking
 *     and tree shaking, and moves a missing-module error to runtime;
 *   - cast the result to `any`, so every grant field was unchecked;
 *   - existed in two copies (student-web and teacher-web) that had already
 *     drifted apart.
 *
 * Everything it did now lives in @repo/livekit with the SDK as a real
 * dependency. These re-exports keep any stray import compiling.
 */

import { getLiveKitConfig as _getLiveKitConfig } from "@repo/livekit";

export {
  getLiveKitConfig,
  isLiveKitConfigured,
  roomNameForSession,
  sessionIdFromRoomName,
  QUALITY_PROFILES,
} from "@repo/livekit";

export { mintClassToken } from "@repo/livekit/server";

/**
 * @deprecated Call POST /api/live/token, or mintClassToken() server-side.
 * Kept as a compile-time landing pad; it throws rather than returning a fake
 * token, because a fake token is how this broke in the first place.
 */
export async function generateLiveKitToken(): Promise<never> {
  throw new Error(
    "generateLiveKitToken() has been removed. Use POST /api/live/token from a client, " +
      "or mintClassToken() from @repo/livekit/server on the server. " +
      "See docs/LIVEKIT.md."
  );
}

/** @deprecated Read `serverUrl` from the /api/live/token response. */
export function getLiveKitWsUrl(): string {
  return _getLiveKitConfig().wsUrl;
}

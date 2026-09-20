/**
 * Guards the removal of the mock-token fallback.
 *
 * The test this replaces asserted the OPPOSITE of what we now want. It
 * verified that, with no LiveKit credentials configured, generateLiveKitToken()
 * "must still return a usable token/wsUrl pair instead of throwing" — and it
 * passed, because the function returned `mock_token_<identity>_<room>_<ts>`.
 *
 * That was the bug, not the safety net. A string like that is not a LiveKit
 * access token: it is unsigned, carries no room grant and has no expiry. The
 * real SFU rejects it. So a production deployment with a missing or misspelled
 * LIVEKIT_API_KEY looked completely healthy — routes returned HTTP 200 with a
 * token in the body — right up until every student's join silently failed.
 *
 * The contract now: an unconfigured server says so, loudly.
 */
import { describe, test, expect } from "vitest";
import { isLiveKitConfigured, roomNameForSession, sessionIdFromRoomName } from "@repo/livekit";
import { generateLiveKitToken } from "./livekit";

describe("livekit configuration", () => {
  test("isLiveKitConfigured() is false unless all three variables are set", () => {
    const configured = Boolean(
      process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET &&
        (process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_URL)
    );
    expect(isLiveKitConfigured()).toBe(configured);
  });

  test("the removed helper throws instead of handing back a fake token", async () => {
    await expect(generateLiveKitToken()).rejects.toThrow(/has been removed/);
  });
});

describe("room naming", () => {
  test("round-trips a session id", () => {
    const id = "6f1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9";
    expect(roomNameForSession(id)).toBe(`class-${id}`);
    expect(sessionIdFromRoomName(roomNameForSession(id))).toBe(id);
  });

  test("ignores rooms we do not own", () => {
    expect(sessionIdFromRoomName("some-other-room")).toBeNull();
  });
});

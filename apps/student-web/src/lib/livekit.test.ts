/**
 * Verifies generateLiveKitToken() actually behaves the way
 * classes/[id]/livekit-token/route.ts now depends on: when LiveKit isn't
 * configured (no LIVEKIT_API_KEY/SECRET/WS_URL — true of a fresh dev
 * checkout before those env vars are set), it must still return a usable
 * token/wsUrl pair instead of throwing or returning something route code
 * can't destructure. That route used to build its own fake
 * `dev-token-${userId}-${sessionId}` string instead of calling this
 * function at all — this test exists to make sure the function it now
 * calls actually works.
 *
 * Run with: tsx src/lib/livekit.test.ts
 * (No install needed — no external imports.)
 */
import { test, expect } from "vitest";
import { generateLiveKitToken, isLiveKitConfigured } from "./livekit";

test("livekit fallback when unconfigured", async () => {
  expect(isLiveKitConfigured()).toBe(false);

  const result = await generateLiveKitToken({
    roomName: "class-abc123",
    identity: "user-1",
    name: "Student",
    role: "student",
  });

  expect(typeof result.token).toBe("string");
  expect(result.token.length).toBeGreaterThan(0);
  expect(result.token.includes("user-1")).toBe(true);
  expect(result.token.includes("class-abc123")).toBe(true);
  expect(typeof result.wsUrl).toBe("string");
  expect(result.wsUrl.startsWith("ws")).toBe(true);
  expect(result.token).toBeDefined();
  expect(result.wsUrl).toBeDefined();
});

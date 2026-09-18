<<<<<<< HEAD
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
import { generateLiveKitToken, isLiveKitConfigured } from "./livekit";

let pass = 0;
let fail = 0;
function check(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`PASS  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
    if (detail !== undefined) console.log("      " + JSON.stringify(detail));
  }
}

async function main() {
  check(
    isLiveKitConfigured() === false,
    "not configured in this environment (no API key/secret/ws url set) — exercising the fallback path the route relies on until real LiveKit credentials are set"
  );

  const result = await generateLiveKitToken({
    roomName: "class-abc123",
    identity: "user-1",
    name: "Student",
    role: "student",
  });

  check(typeof result.token === "string" && result.token.length > 0, "returns a non-empty token string", result);
  check(
    result.token.includes("user-1") && result.token.includes("class-abc123"),
    "mock token is traceable to identity+room for local debugging",
    result
  );
  check(typeof result.wsUrl === "string" && result.wsUrl.startsWith("ws"), "returns a usable wsUrl", result);
  check(
    result.token !== undefined && result.wsUrl !== undefined,
    "neither field is undefined (what the route sends straight to the client)"
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
=======
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { generateLiveKitToken, isLiveKitConfigured, getLiveKitWsUrl } from "./livekit";

describe("LiveKit Token Generation (student-web)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Fallback mode (unconfigured LiveKit)", () => {
    test("detects unconfigured state", () => {
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;
      delete process.env.LIVEKIT_WS_URL;
      delete process.env.LIVEKIT_URL;

      expect(isLiveKitConfigured()).toBe(false);
      expect(getLiveKitWsUrl()).toBe("ws://localhost:7880");
    });

    test("generates server-side token containing correct identity and room scope", async () => {
      const result = await generateLiveKitToken({
        roomName: "room-math-101",
        identity: "student-uuid-456",
        name: "Alice Student",
        role: "student",
      });

      expect(typeof result.token).toBe("string");
      expect(result.token).toContain("student-uuid-456");
      expect(result.token).toContain("room-math-101");
      expect(result.wsUrl).toBe("ws://localhost:7880");
    });

    test("generates distinct unique tokens for separate participants in same room", async () => {
      const token1 = await generateLiveKitToken({
        roomName: "shared-room",
        identity: "user-a",
        name: "Alice",
        role: "student",
      });

      const token2 = await generateLiveKitToken({
        roomName: "shared-room",
        identity: "user-b",
        name: "Bob",
        role: "student",
      });

      expect(token1.token).not.toBe(token2.token);
      expect(token1.token).toContain("user-a");
      expect(token2.token).toContain("user-b");
    });

    test("handles teacher role properly", async () => {
      const result = await generateLiveKitToken({
        roomName: "room-teacher-1",
        identity: "teacher-uuid-1",
        name: "Prof Smith",
        role: "teacher",
        ttl: 7200,
      });

      expect(result.token).toContain("teacher-uuid-1");
      expect(result.token).toContain("room-teacher-1");
    });
  });
});
>>>>>>> 0006b33ac9f3d51abb829acb7fbf00170d608914

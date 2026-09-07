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

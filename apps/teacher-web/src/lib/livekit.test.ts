import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { generateLiveKitToken, isLiveKitConfigured, getLiveKitWsUrl } from "./livekit";

describe("LiveKit Token Generation (teacher-web)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("unconfigured state detection and default wsUrl", () => {
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.LIVEKIT_WS_URL;
    delete process.env.LIVEKIT_URL;

    expect(isLiveKitConfigured()).toBe(false);
    expect(getLiveKitWsUrl()).toBe("ws://localhost:7880");
  });

  test("generates server-side token scoped to session room for teacher", async () => {
    const result = await generateLiveKitToken({
      roomName: "booking-session-999",
      identity: "teacher-id-123",
      name: "Maria Gonzalez",
      role: "teacher",
    });

    expect(result.token).toBeDefined();
    expect(result.token).toContain("teacher-id-123");
    expect(result.token).toContain("booking-session-999");
    expect(result.wsUrl).toBe("ws://localhost:7880");
  });

  test("generates scoped student subscriber token", async () => {
    const result = await generateLiveKitToken({
      roomName: "booking-session-999",
      identity: "student-id-456",
      name: "John Doe",
      role: "student",
    });

    expect(result.token).toContain("student-id-456");
    expect(result.token).toContain("booking-session-999");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("memoryOtpStore", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("in production, refuses to hold OTPs in instance memory", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { memoryOtpStore } = await import("./memory-otp-store");

    expect(() => memoryOtpStore.setHash("a@example.test", "hash")).toThrow(/not available in production/i);
    memoryOtpStore.setVerified("a@example.test");
    expect(memoryOtpStore.isVerified("a@example.test")).toBe(false);
    expect(memoryOtpStore.getHash("a@example.test")).toBeNull();
  });

  it("in development, still stores OTP hashes and verified emails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { memoryOtpStore } = await import("./memory-otp-store");

    memoryOtpStore.setHash("a@example.test", "hash");
    expect(memoryOtpStore.getHash("a@example.test")).toBe("hash");
    memoryOtpStore.setVerified("a@example.test");
    expect(memoryOtpStore.isVerified("a@example.test")).toBe(true);
  });
});

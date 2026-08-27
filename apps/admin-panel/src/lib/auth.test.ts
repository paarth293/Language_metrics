import { describe, it, expect, vi, afterEach } from "vitest";
import { signSession, verifySession } from "./auth";

describe("auth JWT handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const payload = {
    sub: "user-123",
    email: "admin@example.com",
    roleKey: "admin",
    isSuperAdmin: false,
  };

  it("throws when JWT_SECRET is missing", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => signSession(payload)).toThrowError(/JWT_SECRET is not configured/);
  });

  it("throws when JWT_SECRET is too short", () => {
    vi.stubEnv("JWT_SECRET", "short");
    expect(() => signSession(payload)).toThrowError(/JWT_SECRET is too short/);
  });

  it("successfully signs and verifies a token when JWT_SECRET is valid", () => {
    const validSecret = "this_is_a_very_long_and_secure_secret_that_is_over_32_chars";
    vi.stubEnv("JWT_SECRET", validSecret);

    const token = signSession(payload);
    expect(typeof token).toBe("string");

    const decoded = verifySession(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(payload.sub);
    expect(decoded?.email).toBe(payload.email);
  });

  it("returns null for tampered or invalid tokens", () => {
    vi.stubEnv("JWT_SECRET", "this_is_a_very_long_and_secure_secret_that_is_over_32_chars");
    
    const token = signSession(payload);
    const tamperedToken = token + "bad";
    
    expect(verifySession(tamperedToken)).toBeNull();
  });
});

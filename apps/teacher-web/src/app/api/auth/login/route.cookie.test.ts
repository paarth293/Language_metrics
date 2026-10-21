import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

afterEach(() => vi.unstubAllEnvs());

vi.mock("@/features/auth/services/auth-service", () => ({
  AuthService: {
    login: vi.fn().mockResolvedValue({
      user: {
        id: "mock-user-id",
        email: "test@example.com",
        role: "STUDENT",
        emailVerified: true,
      },
    }),
  },
}));

vi.mock("@/lib/redis-session", () => ({
  storeRefreshSession: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/login-lockout", () => ({
  clearFailedLogins: vi.fn(),
  recordFailedLogin: vi.fn(),
  loginLockoutSeconds: vi.fn().mockReturnValue(0),
}));

describe("POST /api/auth/login cookie attributes", () => {
  it("sets lm_teacher_refresh_token with path '/' so proxy can read it on page routes", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    vi.stubEnv("JWT_PRIVATE_KEY", await exportPKCS8(privateKey));
    vi.stubEnv("JWT_PUBLIC_KEY", await exportSPKI(publicKey));

    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "Password123!", role: "STUDENT" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const refreshTokenCookie = res.cookies.get("lm_teacher_refresh_token");
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie?.path).toBe("/");

    const accessTokenCookie = res.cookies.get("lm_teacher_access_token");
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie?.path).toBe("/");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginHandler } from "./login/route";
import { POST as refreshHandler } from "./refresh/route";
import { POST as logoutHandler } from "./logout/route";
import { requireMobileAuth } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
} from "@/lib/tokens";
import {
  storeRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
} from "@/lib/redis-session";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("@/lib/tokens", () => ({
  signAccessToken: vi.fn().mockResolvedValue("mock_access_token_rs256"),
  signRefreshToken: vi.fn().mockResolvedValue("mock_refresh_token_rs256"),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  ACCESS_TOKEN_TTL_SECONDS: 900,
}));

vi.mock("@/lib/redis-session", () => ({
  storeRefreshSession: vi.fn().mockResolvedValue(undefined),
  rotateRefreshSession: vi.fn(),
  revokeRefreshSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRedis: vi.fn().mockResolvedValue(false),
  exceedsMaxBodySize: vi.fn().mockReturnValue(false),
}));

describe("Mobile Authentication & Versioned API Surface (/api/v1/auth/mobile/*)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/mobile/login", () => {
    it("rejects malformed requests with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email: "invalid-email" }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("Validation error");
    });

    it("returns 401 for non-existent users", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email: "student@example.com", password: "Password123!" }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.message).toBe("Invalid email or password.");
    });

    it("returns 401 for incorrect password", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "usr-1",
        email: "student@example.com",
        passwordHash: "hashed_pwd",
        role: "STUDENT",
        emailVerified: true,
        studentProfile: { name: "Test Student", status: "ACTIVE", avatarUrl: null },
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email: "student@example.com", password: "WrongPassword!" }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for suspended student accounts", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "usr-suspended",
        email: "suspended@example.com",
        passwordHash: "hashed_pwd",
        role: "STUDENT",
        emailVerified: true,
        studentProfile: { name: "Suspended Student", status: "SUSPENDED", avatarUrl: null },
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email: "suspended@example.com", password: "Password123!" }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(403);
    });

    it("issues Bearer token pair and JSON user summary on valid credentials", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "usr-100",
        email: "valid.student@example.com",
        passwordHash: "hashed_pwd",
        role: "STUDENT",
        emailVerified: true,
        studentProfile: { name: "Paarth Gupta", status: "ACTIVE", avatarUrl: null },
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/login", {
        method: "POST",
        body: JSON.stringify({ email: "valid.student@example.com", password: "Password123!" }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tokenType).toBe("Bearer");
      expect(data.accessToken).toBe("mock_access_token_rs256");
      expect(data.refreshToken).toBe("mock_refresh_token_rs256");
      expect(data.user.id).toBe("usr-100");
      expect(data.user.role).toBe("STUDENT");
      expect(storeRefreshSession).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/mobile/refresh", () => {
    it("returns 401 when refresh token verification fails", async () => {
      vi.mocked(verifyRefreshToken).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "bad-token-123456" }),
      });

      const res = await refreshHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when Redis session rotation fails (session revoked or reused)", async () => {
      vi.mocked(verifyRefreshToken).mockResolvedValueOnce({
        sub: "usr-100",
        sid: "session-old",
      } as any);
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "usr-100",
        email: "student@example.com",
        role: "STUDENT",
        emailVerified: true,
        studentProfile: { name: "Student", status: "ACTIVE", avatarUrl: null },
      } as any);
      vi.mocked(rotateRefreshSession).mockResolvedValueOnce(false);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "valid-sig-token-12345" }),
      });

      const res = await refreshHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.message).toContain("revoked");
    });

    it("atomically rotates session and issues fresh Bearer tokens", async () => {
      vi.mocked(verifyRefreshToken).mockResolvedValueOnce({
        sub: "usr-100",
        sid: "session-old",
      } as any);
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "usr-100",
        email: "student@example.com",
        role: "STUDENT",
        emailVerified: true,
        studentProfile: { name: "Student", status: "ACTIVE", avatarUrl: null },
      } as any);
      vi.mocked(rotateRefreshSession).mockResolvedValueOnce(true);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "valid-sig-token-12345" }),
      });

      const res = await refreshHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.tokenType).toBe("Bearer");
      expect(data.accessToken).toBe("mock_access_token_rs256");
      expect(data.refreshToken).toBe("mock_refresh_token_rs256");
      expect(rotateRefreshSession).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/mobile/logout", () => {
    it("revokes session in Redis and returns 200", async () => {
      vi.mocked(verifyRefreshToken).mockResolvedValueOnce({
        sub: "usr-100",
        sid: "session-active",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/v1/auth/mobile/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "token-to-revoke-123" }),
      });

      const res = await logoutHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(revokeRefreshSession).toHaveBeenCalledWith("usr-100", "session-active");
    });
  });

  describe("requireMobileAuth middleware helper", () => {
    it("rejects requests missing Authorization header with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/wallet/balance");
      const result = await requireMobileAuth(req);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it("rejects requests with expired/invalid Bearer token with 401", async () => {
      vi.mocked(verifyAccessToken).mockResolvedValueOnce(null);
      const req = new NextRequest("http://localhost:3000/api/v1/wallet/balance", {
        headers: { Authorization: "Bearer expired_or_invalid_jwt" },
      });
      const result = await requireMobileAuth(req);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });

    it("rejects accounts with insufficient role permissions with 403", async () => {
      vi.mocked(verifyAccessToken).mockResolvedValueOnce({
        sub: "usr-teacher-1",
        role: "TEACHER",
        emailVerified: true,
      } as any);
      const req = new NextRequest("http://localhost:3000/api/v1/wallet/balance", {
        headers: { Authorization: "Bearer valid_jwt_for_teacher" },
      });
      const result = await requireMobileAuth(req, ["STUDENT"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it("allows authenticated student requests with valid Bearer token", async () => {
      vi.mocked(verifyAccessToken).mockResolvedValueOnce({
        sub: "usr-student-1",
        role: "STUDENT",
        emailVerified: true,
      } as any);
      const req = new NextRequest("http://localhost:3000/api/v1/wallet/balance", {
        headers: { Authorization: "Bearer valid_jwt_token" },
      });
      const result = await requireMobileAuth(req, ["STUDENT"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.id).toBe("usr-student-1");
        expect(result.user.role).toBe("STUDENT");
      }
    });
  });
});

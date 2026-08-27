import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateAdmin } from "./auth-service";
import { db } from "@repo/database";

// Mock nested dependencies
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(async (input, hash) => input === "correct_password" && hash === "valid_hash"),
  hashPassword: vi.fn(async () => "dummy_hash"),
}));

vi.mock("@/lib/session", () => ({
  createSession: vi.fn(async () => "mocked_session_token"),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
  clearRateLimit: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  assertSameOrigin: vi.fn(async () => true),
}));

vi.mock("@/lib/audit", () => ({
  recordLoginAttempt: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock("@/lib/totp", () => ({
  verifyTotpCode: vi.fn(async (secret, code) => code === "valid_totp"),
  consumeBackupCode: vi.fn(async () => null), // Always fail backup codes for this test
}));

vi.mock("@/lib/csrf", () => ({
  csrfTokensMatch: vi.fn(() => true),
}));

describe("authenticateAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminWithNo2FA = {
    userId: "user-1",
    email: "admin@example.com",
    passwordHash: "valid_hash",
    status: "ACTIVE",
    failedLoginCount: 0,
    roleKey: "admin",
    isSuperAdmin: true,
    user: {
      totpEnabled: false,
      totpSecret: null,
      backupCodes: [],
    },
  };

  const mockAdminWith2FA = {
    ...mockAdminWithNo2FA,
    userId: "user-2",
    user: {
      totpEnabled: true,
      totpSecret: "secret",
      backupCodes: [],
    },
  };

  it("authenticates successfully with valid credentials (no 2FA)", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(mockAdminWithNo2FA as any);

    const result = await authenticateAdmin(
      "admin@example.com",
      "correct_password",
      "127.0.0.1",
      "cookie",
      "form",
      ""
    );

    expect(result).toEqual({ success: true });
  });

  it("rejects with invalid password", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(mockAdminWithNo2FA as any);

    const result = await authenticateAdmin(
      "admin@example.com",
      "wrong_password",
      "127.0.0.1",
      "cookie",
      "form",
      ""
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid credentials/);
  });

  it("rejects with invalid email (not found)", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

    const result = await authenticateAdmin(
      "unknown@example.com",
      "correct_password",
      "127.0.0.1",
      "cookie",
      "form",
      ""
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid credentials/);
  });

  it("returns 2FA_REQUIRED when user has 2FA enabled but no TOTP provided", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(mockAdminWith2FA as any);

    const result = await authenticateAdmin(
      "admin@example.com",
      "correct_password",
      "127.0.0.1",
      "cookie",
      "form",
      "" // Empty TOTP
    );

    expect(result).toEqual({ success: false, error: "2FA_REQUIRED" });
  });

  it("rejects when 2FA is enabled and invalid TOTP is provided", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(mockAdminWith2FA as any);

    const result = await authenticateAdmin(
      "admin@example.com",
      "correct_password",
      "127.0.0.1",
      "cookie",
      "form",
      "wrong_totp"
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid two-factor authentication code/);
  });

  it("authenticates successfully when 2FA is enabled and valid TOTP is provided", async () => {
    vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(mockAdminWith2FA as any);

    const result = await authenticateAdmin(
      "admin@example.com",
      "correct_password",
      "127.0.0.1",
      "cookie",
      "form",
      "valid_totp" // Matches the mock setup
    );

    expect(result).toEqual({ success: true });
  });
});

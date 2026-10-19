// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #35: the login route must refuse an account after repeated failures, not
// just limit per IP.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  compare: vi.fn(),
  lockoutSeconds: vi.fn(async () => 0),
  recordFailed: vi.fn(async () => {}),
  clearFailed: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare } }));
vi.mock("@/lib/login-lockout", () => ({
  loginLockoutSeconds: mocks.lockoutSeconds,
  recordFailedLogin: mocks.recordFailed,
  clearFailedLogins: mocks.clearFailed,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitRedis: async () => false, exceedsMaxBodySize: () => false }));
vi.mock("@/lib/redis-session", () => ({ storeRefreshSession: async () => {} }));
vi.mock("@/lib/tokens", () => ({
  signAccessToken: async () => "access", signRefreshToken: async () => "refresh",
  accessCookieOptions: { path: "/" }, refreshCookieOptions: { path: "/" },
  ACCESS_COOKIE: "a", REFRESH_COOKIE: "r",
}));

const EMAIL = "student@example.test";
const login = () => new Request("https://example.test/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "Password123!" }),
});

beforeEach(() => {
  vi.resetModules();
  for (const m of Object.values(mocks)) m.mockClear();
  mocks.lockoutSeconds.mockResolvedValue(0);
  mocks.compare.mockResolvedValue(false);
  mocks.findUnique.mockResolvedValue({
    id: "u1", email: EMAIL, passwordHash: "hash", role: "STUDENT", emailVerified: true,
    studentProfile: { name: "S", status: "ACTIVE" },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/auth/login lockout (#35)", () => {
  it("answers 429 with Retry-After while the account is locked out", async () => {
    mocks.lockoutSeconds.mockResolvedValue(540);
    const { POST } = await import("./route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NextRequest shape is satisfied by Request here.
    const res = await POST(login() as any);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("540");
    // Locked out before any database work or bcrypt comparison.
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("records a failure on a wrong password", async () => {
    const { POST } = await import("./route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above.
    expect((await POST(login() as any)).status).toBe(401);
    expect(mocks.recordFailed).toHaveBeenCalledWith(EMAIL);
  });

  it("records a failure for an unknown email too", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const { POST } = await import("./route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above.
    expect((await POST(login() as any)).status).toBe(401);
    expect(mocks.recordFailed).toHaveBeenCalledWith(EMAIL);
  });

  it("clears the count after a successful login", async () => {
    mocks.compare.mockResolvedValue(true);
    const { POST } = await import("./route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above.
    expect((await POST(login() as any)).status).toBe(200);
    expect(mocks.clearFailed).toHaveBeenCalledWith(EMAIL);
    expect(mocks.recordFailed).not.toHaveBeenCalled();
  });
});

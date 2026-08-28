import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "./auth";

// Mock the verifyAccessToken dependency
const mockVerifyAccessToken = vi.fn();
vi.mock("@/lib/tokens", () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(cookie?: string): Request {
    const headers = new Headers();
    if (cookie) {
      headers.set("cookie", cookie);
    }
    return new Request("http://localhost/api/test", { headers });
  }

  it("should return 401 MISSING_TOKEN when no access token cookie is present", async () => {
    const req = makeRequest();
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    expect(result.user).toBeUndefined();

    // Verify the response body
    const body = await result.error!.json();
    expect(body.code).toBe("MISSING_TOKEN");
    expect(result.error!.status).toBe(401);
  });

  it("should return 401 MISSING_TOKEN for empty cookie header", async () => {
    const req = makeRequest("");
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("MISSING_TOKEN");
  });

  it("should return 401 INVALID_TOKEN when token verification fails", async () => {
    mockVerifyAccessToken.mockResolvedValue(null);
    const req = makeRequest("lm_access_token=invalid-token");
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("INVALID_TOKEN");
    expect(result.error!.status).toBe(401);
  });

  it("should return 401 INVALID_TOKEN when token has no sub", async () => {
    mockVerifyAccessToken.mockResolvedValue({ role: "STUDENT", emailVerified: true });
    const req = makeRequest("lm_access_token=some-token");
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("INVALID_TOKEN");
  });

  it("should return 403 UNVERIFIED_EMAIL when email is not verified", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-123",
      role: "STUDENT",
      emailVerified: false,
    });
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("UNVERIFIED_EMAIL");
    expect(result.error!.status).toBe(403);
  });

  it("should return 403 INSUFFICIENT_ROLE when user role doesn't match", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-123",
      role: "STUDENT",
      emailVerified: true,
    });
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req, "TEACHER");

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("INSUFFICIENT_ROLE");
    expect(result.error!.status).toBe(403);
  });

  it("should succeed when token is valid and role matches", async () => {
    const payload = {
      sub: "user-123",
      role: "TEACHER",
      emailVerified: true,
    };
    mockVerifyAccessToken.mockResolvedValue(payload);
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req, "TEACHER");

    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user!.sub).toBe("user-123");
    expect(result.user!.role).toBe("TEACHER");
  });

  it("should succeed when no role restriction is specified", async () => {
    const payload = {
      sub: "user-456",
      role: "ADMIN",
      emailVerified: true,
    };
    mockVerifyAccessToken.mockResolvedValue(payload);
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req);

    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user!.sub).toBe("user-456");
    expect(result.user!.role).toBe("ADMIN");
  });

  it("should succeed when user has one of multiple allowed roles", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-789",
      role: "TEACHER",
      emailVerified: true,
    });
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req, "STUDENT", "TEACHER");

    expect(result.error).toBeUndefined();
    expect(result.user).toBeDefined();
    expect(result.user!.role).toBe("TEACHER");
  });

  it("should correctly parse URL-encoded cookie values", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-enc",
      role: "STUDENT",
      emailVerified: true,
    });
    // URL-encoded token value
    const req = makeRequest("lm_access_token=some%20encoded%20token");
    const result = await requireAuth(req);

    expect(result.error).toBeUndefined();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("some encoded token");
  });

  it("should handle multiple cookies correctly", async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: "user-multi",
      role: "STUDENT",
      emailVerified: true,
    });
    const req = makeRequest(
      "other_cookie=value; lm_access_token=target-token; another=value2"
    );
    const result = await requireAuth(req);

    expect(result.error).toBeUndefined();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("target-token");
  });

  it("should return 500 INTERNAL_ERROR when verification throws", async () => {
    mockVerifyAccessToken.mockRejectedValue(new Error("unexpected"));
    const req = makeRequest("lm_access_token=valid-token");
    const result = await requireAuth(req);

    expect(result.error).toBeDefined();
    const body = await result.error!.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(result.error!.status).toBe(500);
  });
});

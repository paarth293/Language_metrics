import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { authenticateAdmin } from "@/lib/auth-service";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth-service", () => ({
  authenticateAdmin: vi.fn(),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 200 on successful login", async () => {
    vi.mocked(authenticateAdmin).mockResolvedValueOnce({ success: true });

    const req = createMockRequest({ email: "admin@example.com", password: "password" });
    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, message: "Logged in successfully" });
  });

  it("returns 401 for invalid credentials", async () => {
    vi.mocked(authenticateAdmin).mockResolvedValueOnce({
      success: false,
      error: "Invalid credentials or account is not active.",
    });

    const req = createMockRequest({ email: "admin@example.com", password: "wrong" });
    const response = await POST(req);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Invalid credentials or account is not active.");
  });

  it("returns 429 for rate limit/lockout", async () => {
    vi.mocked(authenticateAdmin).mockResolvedValueOnce({
      success: false,
      error: "Too many login attempts for this account. Try again later.",
    });

    const req = createMockRequest({ email: "admin@example.com", password: "wrong" });
    const response = await POST(req);

    expect(response.status).toBe(429);
  });

  it("returns 401 for 2FA_REQUIRED", async () => {
    vi.mocked(authenticateAdmin).mockResolvedValueOnce({
      success: false,
      error: "2FA_REQUIRED",
    });

    const req = createMockRequest({ email: "admin@example.com", password: "password" });
    const response = await POST(req);

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("2FA_REQUIRED");
  });
});

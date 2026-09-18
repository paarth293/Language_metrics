import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy";

const EXPO_WEB = "http://localhost:8081";

function makeRequest(method: string, origin?: string) {
  const headers: Record<string, string> = {};
  if (origin) headers.origin = origin;
  return new NextRequest("http://localhost:3002/api/v1/teachers", { method, headers });
}

describe("student-web proxy — CORS for /api/v1/*", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("only runs on the versioned mobile API", () => {
    expect(config.matcher).toEqual(["/api/v1/:path*"]);
  });

  it("answers an allowed preflight with 204 and CORS headers (dev Expo origin)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = proxy(makeRequest("OPTIONS", EXPO_WEB));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXPO_WEB);
    expect(res.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("adds the allow-origin header to actual requests from an allowed origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = proxy(makeRequest("GET", EXPO_WEB));
    expect(res.headers.get("access-control-allow-origin")).toBe(EXPO_WEB);
  });

  it("rejects preflight from an origin that is not allow-listed", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = proxy(makeRequest("OPTIONS", "https://evil.example.com"));
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not trust Expo dev origins in production unless configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOBILE_WEB_ALLOWED_ORIGINS", "");
    const res = proxy(makeRequest("OPTIONS", EXPO_WEB));
    expect(res.status).toBe(403);
  });

  it("allows origins listed in MOBILE_WEB_ALLOWED_ORIGINS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOBILE_WEB_ALLOWED_ORIGINS", "https://m.languagemetrics.com, https://preview.languagemetrics.com/");
    const res = proxy(makeRequest("OPTIONS", "https://preview.languagemetrics.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://preview.languagemetrics.com");
  });

  it("passes native / same-origin requests (no Origin header) straight through", () => {
    const res = proxy(makeRequest("GET"));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

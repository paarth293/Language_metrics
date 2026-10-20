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

  it("runs on every API route (CORS for /api/v1, the Origin check for the rest)", () => {
    expect(config.matcher).toEqual(["/api/:path*"]);
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

const SITE = "http://localhost:3002";

function cookieRequest(method: string, path: string, origin?: string) {
  const headers: Record<string, string> = { host: "localhost:3002", cookie: "lm_student_access_token=t" };
  if (origin) headers.origin = origin;
  return new NextRequest(`${SITE}${path}`, { method, headers });
}

describe("student-web proxy — Origin check on cookie API routes (#18)", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects a cross-origin %s with 403", async (method) => {
    const res = proxy(cookieRequest(method, "/api/students/profile", "https://evil.example"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Cross-origin request rejected." });
  });

  it("rejects a cross-origin coin order", () => {
    expect(proxy(cookieRequest("POST", "/api/payments/create-order", "https://evil.example")).status).toBe(403);
  });

  it("compares hosts exactly, so a look-alike domain is rejected", () => {
    expect(proxy(cookieRequest("POST", "/api/students/profile", "http://localhost:3002.evil.example")).status).toBe(403);
  });

  it("rejects an opaque or malformed Origin", () => {
    expect(proxy(cookieRequest("POST", "/api/students/profile", "null")).status).toBe(403);
    expect(proxy(cookieRequest("POST", "/api/students/profile", "not a url")).status).toBe(403);
  });

  it("lets same-origin and Origin-less writes through", () => {
    expect(proxy(cookieRequest("POST", "/api/students/profile", SITE)).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(cookieRequest("POST", "/api/students/profile")).headers.get("x-middleware-next")).toBe("1");
  });

  it("falls back to the request URL's host when Host is missing", () => {
    const req = new NextRequest(`${SITE}/api/students/profile`, { method: "POST", headers: { origin: "https://evil.example" } });
    expect(proxy(req).status).toBe(403);
  });

  it("does not check reads", () => {
    expect(proxy(cookieRequest("GET", "/api/students/profile", "https://evil.example")).headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves signed webhooks alone", () => {
    for (const path of ["/api/webhooks/cashfree", "/api/webhooks/livekit"]) {
      expect(proxy(cookieRequest("POST", path, "https://evil.example")).headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("keeps /api/v1 (Bearer only) on CORS rules instead", () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = proxy(cookieRequest("POST", "/api/v1/teachers", EXPO_WEB));
    expect(res.status).not.toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXPO_WEB);
    vi.unstubAllEnvs();
  });
});

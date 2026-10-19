import { NextRequest } from "next/server";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

// Next forwards request headers set by a proxy to the handler as
// `x-middleware-request-<name>` on the proxy's response.
const forwardedId = (res: Response) => res.headers.get("x-middleware-request-x-request-id");

afterEach(() => vi.unstubAllEnvs());

describe("teacher-web proxy: one request ID per request (#8b)", () => {
  it("gives API routes the same ID it returns to the client", async () => {
    const res = await proxy(new NextRequest("https://teacher.example.test/api/health"));
    const id = res.headers.get("X-Request-ID");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwardedId(res)).toBe(id);
  });

  it("keeps a safe incoming X-Request-ID", async () => {
    const res = await proxy(new NextRequest("https://teacher.example.test/login", { headers: { "x-request-id": "edge-abc-1" } }));
    expect(res.headers.get("X-Request-ID")).toBe("edge-abc-1");
    expect(forwardedId(res)).toBe("edge-abc-1");
  });

  it("replaces an unsafe incoming X-Request-ID", async () => {
    const res = await proxy(new NextRequest("https://teacher.example.test/login", { headers: { "x-request-id": 'bad", "x' } }));
    expect(res.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("forwards the same ID on authenticated pages", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    vi.stubEnv("JWT_PUBLIC_KEY", await exportSPKI(publicKey));
    const token = await new SignJWT({ role: "TEACHER", emailVerified: true })
      .setProtectedHeader({ alg: "RS256" }).setSubject("teacher-1").setIssuer("lm-auth").setAudience("lm-teacher-web")
      .setExpirationTime("5m").sign(privateKey);
    const res = await proxy(new NextRequest("https://teacher.example.test/teacher/dashboard", {
      headers: { cookie: `lm_teacher_access_token=${token}` },
    }));
    const id = res.headers.get("X-Request-ID");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(forwardedId(res)).toBe(id);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("teacher-1");
  });
});

import { NextRequest } from "next/server";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("teacher-web proxy: auth, routing, and silent refresh", () => {
  it("passes through authenticated student accessing /student/discover", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    vi.stubEnv("JWT_PUBLIC_KEY", await exportSPKI(publicKey));
    const token = await new SignJWT({ role: "STUDENT", emailVerified: true })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("student-123")
      .setIssuer("lm-auth")
      .setAudience("lm-teacher-web")
      .setExpirationTime("15m")
      .sign(privateKey);

    const req = new NextRequest("https://www.languagemetrics.in/student/discover", {
      headers: { cookie: `lm_teacher_access_token=${token}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("student-123");
    expect(res.headers.get("x-middleware-request-x-user-role")).toBe("STUDENT");
  });

  it("redirects unauthenticated visitor to /login with target path preserved", async () => {
    const req = new NextRequest("https://www.languagemetrics.in/student/discover?language=Spanish");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?next=%2Fstudent%2Fdiscover%3Flanguage%3DSpanish");
  });

  it("redirects to /api/auth/silent-refresh when access token is missing but refresh token exists", async () => {
    const req = new NextRequest("https://www.languagemetrics.in/student/discover", {
      headers: { cookie: "lm_teacher_refresh_token=valid-mock-refresh-token" },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/api/auth/silent-refresh?next=%2Fstudent%2Fdiscover");
  });

  it("redirects to /api/auth/silent-refresh when access token is expired but refresh token exists", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    vi.stubEnv("JWT_PUBLIC_KEY", await exportSPKI(publicKey));

    // Sign a token that expired 1 minute ago
    const expiredToken = await new SignJWT({ role: "STUDENT", emailVerified: true })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("student-123")
      .setIssuer("lm-auth")
      .setAudience("lm-teacher-web")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    const req = new NextRequest("https://www.languagemetrics.in/student/discover", {
      headers: {
        cookie: `lm_teacher_access_token=${expiredToken}; lm_teacher_refresh_token=valid-mock-refresh-token`,
      },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/api/auth/silent-refresh?next=%2Fstudent%2Fdiscover");
  });

  it("redirects student away from teacher dashboard to student dashboard (RBAC enforcement)", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    vi.stubEnv("JWT_PUBLIC_KEY", await exportSPKI(publicKey));
    const token = await new SignJWT({ role: "STUDENT", emailVerified: true })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("student-123")
      .setIssuer("lm-auth")
      .setAudience("lm-teacher-web")
      .setExpirationTime("15m")
      .sign(privateKey);

    const req = new NextRequest("https://www.languagemetrics.in/teacher/dashboard", {
      headers: { cookie: `lm_teacher_access_token=${token}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://www.languagemetrics.in/student/dashboard");
  });
});

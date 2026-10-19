import { createServer, type Server } from "node:http";
import { createServer as createTcpServer, type Server as TcpServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real servers that accept connections and never answer: an HTTP one (Google,
// Resend) and a TCP one that never sends an SMTP greeting (Zoho). Only a
// timeout set by our code can end these calls.
let http: Server;
let slowUrl = "";
let smtp: TcpServer;
let smtpPort = 0;
const smtpSockets = new Set<Socket>();

beforeAll(async () => {
  http = createServer(() => {});
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  slowUrl = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  smtp = createTcpServer((socket) => {
    smtpSockets.add(socket);
    socket.on("close", () => smtpSockets.delete(socket));
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  smtpPort = (smtp.address() as AddressInfo).port;
});
afterAll(() => {
  http.closeAllConnections();
  http.close();
  for (const socket of smtpSockets) socket.destroy();
  smtp.close();
});

const realFetch = globalThis.fetch;
const realTimeout = AbortSignal.timeout.bind(AbortSignal);
let requested: number[] = [];

beforeEach(() => {
  vi.resetModules();
  requested = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    requested.push(ms);
    return realTimeout(200);
  });
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => realFetch(slowUrl + new URL(url).pathname, init));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("JWT_PRIVATE_KEY", "private");
  vi.stubEnv("JWT_PUBLIC_KEY", "public");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function timed<T>(promise: Promise<T>) {
  const started = Date.now();
  const result = await promise.then((value) => ({ value, error: null as unknown }), (error: unknown) => ({ value: null, error }));
  return { ...result, ms: Date.now() - started };
}

describe("Google OAuth gives up on a Google that never answers", () => {
  it("token exchange (POST) fails within 8 s with a clear error, no retry", async () => {
    const { exchangeGoogleCode } = await import("./oauth");
    const { error, ms } = await timed(exchangeGoogleCode("code"));
    expect((error as Error).message).toBe("Google sign-in did not respond in time. Please try again.");
    expect(requested).toEqual([8_000]);
    expect(ms).toBeLessThan(2_000);
  });

  it("profile lookup (GET) fails within 8 s with a clear error", async () => {
    // Token endpoint answers; the userinfo endpoint is the slow one.
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
      url.includes("/token")
        ? Promise.resolve(new Response(JSON.stringify({ access_token: "at" })))
        : realFetch(slowUrl + new URL(url).pathname, init));
    const { exchangeGoogleCode } = await import("./oauth");
    const { error } = await timed(exchangeGoogleCode("code"));
    expect((error as Error).message).toBe("Google sign-in did not respond in time. Please try again.");
    expect(requested).toEqual([8_000, 8_000]);
  });
});

describe("email gives up on providers that never answer", () => {
  it("Resend (verification link email) returns within 10 s instead of hanging", async () => {
    const { sendVerificationEmail } = await import("./email");
    const { ms } = await timed(sendVerificationEmail("a@example.test", "A", "token"));
    expect(requested).toEqual([10_000]);
    expect(ms).toBeLessThan(2_000);
  });

  it("Zoho SMTP with no greeting, then Resend, both time out and sendMail returns", async () => {
    vi.stubEnv("ZOHO_SMTP_HOST", "127.0.0.1");
    vi.stubEnv("ZOHO_SMTP_PORT", String(smtpPort));
    vi.stubEnv("ZOHO_EMAIL", "sender@example.test");
    vi.stubEnv("ZOHO_APP_PASSWORD", "app-password");
    const mailer = await import("./zoho-mailer");
    Object.assign(mailer.SMTP_TIMEOUTS, { connectionTimeout: 200, greetingTimeout: 200, socketTimeout: 200 });
    const warn = vi.mocked(console.warn);
    const { error, ms } = await timed(mailer.sendMail({ to: "a@example.test", subject: "s", html: "<p>hi</p>" }));
    expect(error).toBeNull();
    expect(ms).toBeLessThan(3_000);
    expect(String(warn.mock.calls.find((c) => String(c[0]).includes("Zoho"))?.[1])).toMatch(/Greeting never received|timeout/i);
    expect(requested).toEqual([10_000]); // the Resend fallback
  });

  it("uses 10 s / 10 s / 15 s SMTP timeouts in production", async () => {
    const { SMTP_TIMEOUTS } = await import("./zoho-mailer");
    expect(SMTP_TIMEOUTS).toEqual({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
  });
});

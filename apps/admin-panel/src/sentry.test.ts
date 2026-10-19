import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sentry itself is mocked: these tests check when it is switched on and what
// may leave the server, never send anything.
const sentry = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("./env", () => ({ validateEnvOnBoot: () => {} }));

beforeEach(() => {
  vi.resetModules();
  sentry.init.mockReset();
  sentry.captureRequestError.mockReset();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});
afterEach(() => vi.unstubAllEnvs());

const requestErrorArgs = [new Error("boom"), { path: "/x", method: "GET", headers: {} }, { routerKind: "App Router", routePath: "/x", routeType: "route", revalidateReason: undefined }] as const;

describe("Sentry (#8a): only active when SENTRY_DSN is set", () => {
  it("does nothing without SENTRY_DSN", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { register, onRequestError } = await import("./instrumentation");
    await register();
    await onRequestError(...requestErrorArgs);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureRequestError).not.toHaveBeenCalled();
  });

  it("starts Sentry without default PII and reports request errors when SENTRY_DSN is set", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.example.test/1");
    const { register, onRequestError } = await import("./instrumentation");
    await register();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0]![0];
    expect(options).toMatchObject({ dsn: "https://key@o1.ingest.example.test/1", sendDefaultPii: false });
    expect(typeof options.beforeSend).toBe("function");
    await onRequestError(...requestErrorArgs);
    expect(sentry.captureRequestError).toHaveBeenCalledWith(...requestErrorArgs);
  });
});

describe("scrubEvent: what may leave the server", () => {
  it("drops cookies, bodies, query strings and secret-bearing headers", async () => {
    const { scrubEvent } = await import("./sentry");
    const event = scrubEvent({
      request: {
        url: "https://app.example.test/api/auth/reset?token=abc",
        query_string: "token=abc",
        cookies: { lm_student_access_token: "jwt" },
        data: { password: "hunter2", otp: "123456" },
        headers: {
          Authorization: "Bearer jwt",
          cookie: "lm_student_access_token=jwt",
          "x-webhook-signature": "sig",
          "x-client-secret": "cf",
          "user-agent": "Mozilla",
        },
      },
    });
    expect(event?.request).toEqual({
      url: "https://app.example.test/api/auth/reset",
      headers: { "user-agent": "Mozilla" },
    });
  });
});

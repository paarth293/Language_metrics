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

// #8: secrets inside the error itself (message, stack, extra, contexts,
// breadcrumbs) are masked the same way @repo/logger masks log lines.
// Built at runtime so the repo's secret linter does not flag the fixtures.
const DB_URL = ["postgresql://app", "pw@db.example.test:5432/app"].join(":");
const JWT = ["eyJhbGciOiJSUzI1NiJ9", "eyJzdWIiOiJ1c2VyLTEifQ", "c2lnbmF0dXJl"].join(".");

describe("beforeSend / beforeBreadcrumb: secrets inside the error", () => {
  it("masks a database URL password and a JWT in the message, stack, extra and contexts", async () => {
    const { sentryOptions } = await import("./sentry");
    const options = sentryOptions("https://key@o1.ingest.example.test/1");
    const text = `Can't reach ${DB_URL} for token ${JWT}`;
    const event = options.beforeSend({
      message: text,
      logentry: { message: text, params: [JWT] },
      exception: {
        values: [{
          type: "PrismaClientInitializationError",
          value: text,
          stacktrace: { frames: [{ filename: "db.ts", context_line: `connect("${DB_URL}")`, pre_context: [JWT], post_context: [], vars: { url: DB_URL, accessToken: "plain" } }] },
        }],
      },
      extra: { url: DB_URL, nested: { header: `Bearer ${JWT}` } },
      contexts: { db: { connection: DB_URL }, auth: { session: JWT } },
      breadcrumbs: [{ category: "console", message: text, data: { url: `https://api.example.test/x?token=${JWT}` } }],
    });
    const sent = JSON.stringify(event);
    expect(sent).not.toContain(":pw@");
    expect(sent).not.toContain(JWT);
    expect(sent).not.toContain('"plain"');
    expect(sent).not.toContain("?token=");
    expect(sent).toContain("PrismaClientInitializationError"); // still useful
    expect(sent).toContain("db.example.test");
  });

  it("masks breadcrumbs as they are recorded and drops URL query strings", async () => {
    const { sentryOptions } = await import("./sentry");
    const { beforeBreadcrumb } = sentryOptions("https://key@o1.ingest.example.test/1");
    const crumb = beforeBreadcrumb({
      category: "fetch",
      message: `GET ${DB_URL}`,
      data: { url: `https://api.example.test/reset?token=${JWT}`, method: "GET", status_code: 500 },
    });
    expect(crumb).toEqual({
      category: "fetch",
      message: `GET ${DB_URL.replace(":pw@", ":[REDACTED]@")}`,
      data: { url: "https://api.example.test/reset", method: "GET", status_code: 500 },
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { CSP_HEADER, contentSecurityPolicy } from "./csp";

// student-web runs Cashfree checkout and the LiveKit classroom but sent no
// Content-Security-Policy at all (#17).

function directives(policy: string): Map<string, string[]> {
  return new Map(policy.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name!, values]));
}

const prod = { NODE_ENV: "production" } as NodeJS.ProcessEnv;

describe("student-web Content-Security-Policy (#17)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is sent on every page by next.config", async () => {
    const { default: config } = await import("../next.config");
    const rules = (await config.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/(.*)");
    const csp = all?.headers.find((h) => h.key === CSP_HEADER);
    expect(csp?.value).toBe(contentSecurityPolicy(process.env));
  });

  it("starts in Report-Only until checkout and the classroom are checked in a browser", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only");
  });

  it("locks down plugins, base URLs and framing", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d.get("default-src")).toEqual(["'self'"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'self'"]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("allows the Cashfree SDK, its API and its payment frames, without eval in production", () => {
    const d = directives(contentSecurityPolicy(prod));
    expect(d.get("script-src")).toContain("https://sdk.cashfree.com");
    expect(d.get("script-src")).not.toContain("'unsafe-eval'");
    expect(d.get("connect-src")).toContain("https://api.cashfree.com");
    for (const host of ["https://sdk.cashfree.com", "https://api.cashfree.com", "https://payments.cashfree.com"]) {
      expect(d.get("frame-src")).toContain(host);
      expect(d.get("form-action")).toContain(host);
    }
  });

  it("trusts Cashfree's test hosts only in sandbox mode", () => {
    const live = contentSecurityPolicy(prod);
    expect(live).not.toContain("sandbox.cashfree.com");
    expect(live).not.toContain("payments-test.cashfree.com");
    const sandbox = directives(contentSecurityPolicy({ ...prod, CASHFREE_ENV: "sandbox" }));
    expect(sandbox.get("connect-src")).toContain("https://sandbox.cashfree.com");
    expect(sandbox.get("frame-src")).toContain("https://payments-test.cashfree.com");
  });

  it("lets the classroom reach LiveKit Cloud and a self-hosted LiveKit server", () => {
    expect(directives(contentSecurityPolicy(prod)).get("connect-src")).toEqual(
      expect.arrayContaining(["wss://*.livekit.cloud", "https://*.livekit.cloud"]),
    );
    const selfHosted = directives(contentSecurityPolicy({ ...prod, LIVEKIT_WS_URL: "wss://rtc.example.test:7880" }));
    expect(selfHosted.get("connect-src")).toEqual(expect.arrayContaining(["wss://rtc.example.test:7880", "https://rtc.example.test:7880"]));
    expect(() => contentSecurityPolicy({ ...prod, LIVEKIT_WS_URL: "wss://" })).not.toThrow();
  });

  it("allows https images, since students may paste any avatar URL", () => {
    expect(directives(contentSecurityPolicy(prod)).get("img-src")).toEqual(expect.arrayContaining(["'self'", "data:", "blob:", "https:"]));
  });

  it("lets browser Sentry send events and receives violation reports when a DSN is set", () => {
    expect(contentSecurityPolicy(prod)).not.toContain("report-uri");
    const dsn = ["https://", "abc123", "@o42.ingest.sentry.io/7"].join("");
    const d = directives(contentSecurityPolicy({ ...prod, NEXT_PUBLIC_SENTRY_DSN: dsn }));
    expect(d.get("connect-src")).toContain("https://o42.ingest.sentry.io");
    expect(d.get("report-uri")).toEqual(["https://o42.ingest.sentry.io/api/7/security/?sentry_key=abc123"]);
    expect(() => contentSecurityPolicy({ ...prod, NEXT_PUBLIC_SENTRY_DSN: "not a url" })).not.toThrow();
  });

  it("keeps eval for Next's dev overlay outside production", () => {
    expect(directives(contentSecurityPolicy({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).get("script-src")).toContain("'unsafe-eval'");
  });
});

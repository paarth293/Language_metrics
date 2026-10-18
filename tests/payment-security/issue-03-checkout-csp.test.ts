import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The checkout script and its iframes come from Cashfree's CDN, so any page
 * that sells something must allow them. Origins per Cashfree's cashfree-js
 * README ("Content Security Policy"). The test-mode hosts are allowed only
 * when CASHFREE_ENV is "sandbox".
 */
const REQUIRED = {
  "script-src": ["https://sdk.cashfree.com"],
  "connect-src": ["https://api.cashfree.com"],
  "frame-src": ["https://sdk.cashfree.com", "https://api.cashfree.com", "https://payments.cashfree.com"],
  // The modal checkout POSTs a hidden form into its iframe; without these the popup stays blank.
  "form-action": ["'self'", "https://api.cashfree.com", "https://payments.cashfree.com"],
};
const SANDBOX_HOSTS = ["https://sandbox.cashfree.com", "https://payments-test.cashfree.com"];

async function cspOf(configPath: string, cashfreeEnv = "production") {
  vi.resetModules();
  vi.stubEnv("CASHFREE_ENV", cashfreeEnv);
  const config = (await import(configPath)).default;
  const rules: Array<{ source: string; headers: Array<{ key: string; value: string }> }> = await config.headers();
  const value = rules.flatMap((rule) => rule.headers).find((h) => h.key === "Content-Security-Policy")?.value;
  if (!value) return null;
  return Object.fromEntries(value.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
}

afterEach(() => vi.unstubAllEnvs());

describe("issue #3: checkout pages allow the Cashfree SDK under CSP", () => {
  it("teacher-web, which serves the student wallet and recordings pages", async () => {
    const csp = await cspOf("../../apps/teacher-web/next.config.ts");
    expect(csp).not.toBeNull();
    for (const [directive, origins] of Object.entries(REQUIRED)) {
      for (const origin of origins) expect(csp![directive], `${directive} must allow ${origin}`).toContain(origin);
    }
  });

  it("trusts Cashfree's test-mode hosts only in sandbox mode", async () => {
    const production = await cspOf("../../apps/teacher-web/next.config.ts", "production");
    const sandbox = await cspOf("../../apps/teacher-web/next.config.ts", "sandbox");
    for (const directive of ["connect-src", "frame-src", "form-action"]) {
      for (const host of SANDBOX_HOSTS) expect(production![directive], `production ${directive}`).not.toContain(host);
    }
    for (const directive of ["frame-src", "form-action"]) {
      for (const host of SANDBOX_HOSTS) expect(sandbox![directive], `sandbox ${directive}`).toContain(host);
    }
    expect(sandbox!["connect-src"]).toContain("https://sandbox.cashfree.com");
  });

  it("does not weaken the rest of the policy", async () => {
    const csp = await cspOf("../../apps/teacher-web/next.config.ts");
    expect(csp!["default-src"]).toEqual(["'self'"]);
    expect(csp!["object-src"]).toEqual(["'none'"]);
    expect(csp!["script-src"]).not.toContain("*");
    expect(csp!["frame-src"]).not.toContain("*");
    expect(csp!["form-action"]).not.toContain("*");
  });

  it("student-web, which sends no CSP, does not block the SDK", async () => {
    const csp = await cspOf("../../apps/student-web/next.config.ts");
    if (csp) for (const origin of REQUIRED["script-src"]) expect(csp["script-src"]).toContain(origin);
  });
});

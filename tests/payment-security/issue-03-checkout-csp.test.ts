import { describe, expect, it } from "vitest";

/**
 * The checkout script and its iframes come from Cashfree's CDN, so any page
 * that sells something must allow them. Origins per Cashfree's cashfree-js
 * README ("Content Security Policy"); sandbox.cashfree.com is added to
 * connect-src because the app runs Cashfree in sandbox mode by default.
 */
const REQUIRED = {
  "script-src": ["https://sdk.cashfree.com"],
  "connect-src": ["https://api.cashfree.com", "https://sandbox.cashfree.com"],
  "frame-src": ["https://sdk.cashfree.com", "https://api.cashfree.com", "https://sandbox.cashfree.com", "https://payments.cashfree.com", "https://payments-test.cashfree.com"],
  // The modal checkout POSTs a hidden form into its iframe; without these the popup stays blank.
  "form-action": ["'self'", "https://api.cashfree.com", "https://sandbox.cashfree.com"],
};

async function cspOf(configPath: string) {
  const config = (await import(configPath)).default;
  const rules: Array<{ source: string; headers: Array<{ key: string; value: string }> }> = await config.headers();
  const value = rules.flatMap((rule) => rule.headers).find((h) => h.key === "Content-Security-Policy")?.value;
  if (!value) return null;
  return Object.fromEntries(value.split(";").map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
}

describe("issue #3: checkout pages allow the Cashfree SDK under CSP", () => {
  it("teacher-web, which serves the student recordings page", async () => {
    const csp = await cspOf("../../apps/teacher-web/next.config.ts");
    expect(csp).not.toBeNull();
    for (const [directive, origins] of Object.entries(REQUIRED)) {
      for (const origin of origins) expect(csp![directive], `${directive} must allow ${origin}`).toContain(origin);
    }
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

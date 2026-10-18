import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Payment-secret scan over the working tree and the whole git history.
 * Complements gitleaks (run in CI per .gitleaks.toml), which is not installed
 * locally. Findings are printed masked; a real value is never echoed.
 */
const root = join(__dirname, "../..");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });

const PATTERNS: Array<[string, RegExp]> = [
  ["Cashfree secret key", /cfsk_ma_(?:prod|test)_[A-Za-z0-9]{8,}/g],
  ["Razorpay key", /rzp_(?:live|test)_[A-Za-z0-9]{10,}/g],
  ["payment env var with a value", /\b(?:CASHFREE_CLIENT_SECRET|CASHFREE_CLIENT_ID|CASHFREE_SANDBOX_CLIENT_SECRET|RAZORPAY_KEY_SECRET|RAZORPAY_KEY_ID|RAZORPAY_WEBHOOK_SECRET|CRON_SECRET|PAYMENT_ALERT_WEBHOOK_URL)[ \t]*=[ \t]*["']?[^\s"'$]{8,}/g],
  ["Slack webhook URL", /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g],
  // Key material, not the documented "-----BEGIN PRIVATE KEY-----\n...\n" placeholder.
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----(?:\\n|\r?\n)[A-Za-z0-9+/=]{40,}/g],
];

const mask = (value: string) => (value.length <= 8 ? "****" : `${value.slice(0, 8)}****`);

/**
 * Obvious test fixtures, e.g. `RAZORPAY_KEY_SECRET = 'test_secret'` in the
 * removed pre-Cashfree Razorpay unit test. Only for env-var assignments.
 */
const FIXTURE_VALUE = /=[ \t]*["']?(?:test|dummy|fake|example|sample)[_-]?[a-z]*["']?$/i;

function scan(text: string, where: (index: number) => string, labels = PATTERNS.map(([label]) => label)) {
  const findings: string[] = [];
  for (const [label, pattern] of PATTERNS) {
    if (!labels.includes(label)) continue;
    for (const match of text.matchAll(pattern)) {
      if (label === "payment env var with a value" && FIXTURE_VALUE.test(match[0])) continue;
      findings.push(`${label}: ${mask(match[0])} at ${where(match.index ?? 0)}`);
    }
  }
  return findings;
}

describe("9. secret scan", () => {
  const tracked = git("ls-files").split("\n").filter(Boolean).filter((f) => f !== "package-lock.json" && !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|pdf|db)$/i.test(f));

  it("no payment secret in any tracked file", () => {
    const findings = tracked.flatMap((file) => {
      let text: string;
      try { text = readFileSync(join(root, file), "utf8"); } catch { return []; }
      return scan(text, (i) => `${file}:${text.slice(0, i).split("\n").length}`);
    });
    expect(findings, findings.join("\n")).toEqual([]);
  });

  describe("git history", () => {
    // --no-textconv/--no-ext-diff: the repo's PDF diff driver fails outside a
    // configured machine and would abort `git log -p` partway through history.
    // Each commit starts with a NUL marker so file content cannot fake one.
    const history = git("log", "--all", "-p", "--no-color", "--no-textconv", "--no-ext-diff", "--format=%x00commit %H");
    const commitAt = (i: number) => {
      const start = history.lastIndexOf("\u0000commit ", i);
      return `commit ${history.slice(start + 8, start + 20)}`;
    };
    const paymentLabels = PATTERNS.map(([label]) => label).filter((label) => label !== "private key");

    it("covers the whole history", () => {
      expect(history.length).toBeGreaterThan(1_000_000);
      expect(history.split("\u0000commit ").length - 1).toBe(Number(git("rev-list", "--all", "--count").trim()));
    });

    it("no payment secret anywhere in git history", () => {
      const findings = scan(history, commitAt, paymentLabels);
      expect(findings, findings.join("\n")).toEqual([]);
    }, 120_000);

    it("no private key material anywhere in git history", () => {
      const findings = scan(history, commitAt, ["private key"]);
      expect(findings, findings.join("\n")).toEqual([]);
    }, 120_000);
  });

  it("the only tracked env files are examples, and their payment values are empty", () => {
    const envFiles = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f));
    expect(envFiles.every((f) => f.endsWith(".env.example")), envFiles.join(", ")).toBe(true);
    for (const file of envFiles) {
      for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
        if (/^(CASHFREE_CLIENT_(ID|SECRET)|CRON_SECRET|PAYMENT_ALERT_WEBHOOK_URL)=/.test(line)) expect(line, `${file}`).toMatch(/=""?$/);
      }
    }
  });

  it("no client-side code reads a server secret, and no secret is exposed as NEXT_PUBLIC_", () => {
    const sources = tracked.filter((f) => /\.(t|j)sx?$/.test(f) && !f.startsWith("tests/"));
    const offenders = sources.filter((file) => {
      const text = readFileSync(join(root, file), "utf8");
      const clientSide = /^\s*['"]use client['"]/m.test(text) || file.startsWith("packages/ui/");
      return (clientSide && /process\.env\.(CASHFREE_CLIENT_SECRET|CRON_SECRET|PAYMENT_ALERT_WEBHOOK_URL)/.test(text))
        || /NEXT_PUBLIC_[A-Z_]*(SECRET|CASHFREE)/.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

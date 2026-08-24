#!/usr/bin/env node
/**
 * generate-sast-report.mjs
 * ────────────────────────
 * Reads semgrep JSON output (from npm run scan:sast) and
 * appends/updates the SAST section of SECURITY_REPORT.md.
 *
 * Usage:
 *   npm run scan:sast                          # writes sast-results.json
 *   node security-tests/generate-sast-report.mjs   # converts to Markdown
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const JSON_INPUT = join(ROOT, "sast-results.json");
const MD_OUTPUT = join(ROOT, "SECURITY_REPORT.md");

const OWASP_MAP = {
  "secrets":        "A02:2021 – Cryptographic Failures",
  "injection":      "A03:2021 – Injection",
  "auth":           "A07:2021 – Identification and Authentication Failures",
  "access-control": "A01:2021 – Broken Access Control",
  "xss":            "A03:2021 – Injection (XSS)",
  "ssrf":           "A10:2021 – Server-Side Request Forgery",
  "default":        "A05:2021 – Security Misconfiguration",
};

function mapOwasp(tags = []) {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, val] of Object.entries(OWASP_MAP)) {
      if (lower.includes(key)) return val;
    }
  }
  return OWASP_MAP.default;
}

function severityEmoji(sev) {
  return { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢", INFO: "ℹ️" }[sev?.toUpperCase()] ?? "⚪";
}

if (!existsSync(JSON_INPUT)) {
  console.error(`[ERROR] ${JSON_INPUT} not found. Run: npm run scan:sast first.`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(JSON_INPUT, "utf8"));
const findings = raw.results ?? [];

if (findings.length === 0) {
  console.log("✅ No SAST findings. SECURITY_REPORT.md SAST section will show clean.");
}

const rows = findings.map((f) => {
  const sev = f.extra?.severity ?? f.severity ?? "INFO";
  const tags = f.extra?.metadata?.tags ?? [];
  return {
    rule: f.check_id ?? "unknown",
    file: f.path,
    line: f.start?.line ?? "?",
    severity: sev,
    owasp: mapOwasp(tags),
    message: (f.extra?.message ?? "").replace(/\n/g, " ").slice(0, 100),
  };
});

// Sort: CRITICAL first
const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
rows.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

const tableRows = rows.map(
  (r) =>
    `| ${severityEmoji(r.severity)} ${r.severity} | \`${r.rule}\` | \`${r.file}:${r.line}\` | ${r.owasp} | ${r.message} |`
);

const date = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const section = [
  `## 🔍 SAST Findings (Semgrep) — ${date}`,
  "",
  `**Total:** ${rows.length} finding(s)`,
  "",
  "| Severity | Rule | Location | OWASP | Message |",
  "|----------|------|----------|-------|---------|",
  ...tableRows,
  "",
].join("\n");

// Append to or create SECURITY_REPORT.md
let existing = existsSync(MD_OUTPUT) ? readFileSync(MD_OUTPUT, "utf8") : "";

// Replace existing SAST section if present
const sectionRegex = /## 🔍 SAST Findings[\s\S]*?(?=\n## |\n---|\n*$)/;
if (sectionRegex.test(existing)) {
  existing = existing.replace(sectionRegex, section);
} else {
  existing = existing + "\n" + section;
}

writeFileSync(MD_OUTPUT, existing, "utf8");
console.log(`✅ SAST section written to SECURITY_REPORT.md (${rows.length} findings)`);

#!/usr/bin/env node
/**
 * Blocking dependency audit for the three web apps' production code (#16).
 *
 * `npm audit --omit=dev --audit-level=high` alone cannot gate CI here: it
 * also reports student-mobile's Expo / React Native tree, whose fixes need an
 * Expo major upgrade (a tracked follow-up), and `npm audit -w` over-reports
 * hoisted packages (it flags braces/micromatch, which only reach the tree via
 * ESLint and Expo). So this script:
 *
 *   1. runs `npm audit --omit=dev --json`;
 *   2. lists every package installed in the production trees of student-web,
 *      teacher-web and admin-panel (`npm ls --omit=dev --all --parseable`);
 *   3. fails on any high or critical advisory touching one of those packages.
 *
 * Findings outside that tree are printed as "not blocking".
 *
 * Usage: node scripts/audit-web-prod.mjs [--audit-json file] [--tree file]
 * (the file options replay saved output, e.g. to check an older lockfile.)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const WEB_APPS = ["student-web", "teacher-web", "admin-panel"];
const BLOCKING = new Set(["high", "critical"]);
// Tracked upstream advisories accepted pending scheduled framework upgrades (#16).
// - next: GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr
// - zod: GHSA-mrhx-c7xc-m3w5 (also pinned by expo in student-mobile)
const ACCEPTED_PACKAGES = new Set(["next", "zod"]);
const root = resolve(import.meta.dirname, "..");

function npm(args) {
  // npm audit / ls exit non-zero when they find something; the output is still valid.
  try {
    return execFileSync("npm", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: process.platform === "win32" });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) return error.stdout;
    throw error;
  }
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** "node_modules/a/node_modules/b" style paths, as npm audit reports them. */
function toNodePath(path) {
  const relativePath = isAbsolute(path) ? relative(root, path) : path;
  return relativePath.replaceAll("\\", "/");
}

const auditFile = option("--audit-json");
const treeFile = option("--tree");
const audit = JSON.parse(auditFile ? readFileSync(auditFile, "utf8") : npm(["audit", "--omit=dev", "--json"]));
const tree = treeFile
  ? readFileSync(treeFile, "utf8")
  : npm(["ls", "--omit=dev", "--all", "--parseable", ...WEB_APPS.flatMap((app) => ["-w", app])]);
const webPackages = new Set(tree.split(/\r?\n/).filter(Boolean).map(toNodePath));

const blocking = [];
const notBlocking = [];
for (const [name, vulnerability] of Object.entries(audit.vulnerabilities ?? {})) {
  const inWebApps = vulnerability.nodes.some((node) => webPackages.has(node));
  const isAccepted = ACCEPTED_PACKAGES.has(name);
  const line = `${name} (${vulnerability.severity}) ${vulnerability.nodes.join(", ")}`;
  if (inWebApps && BLOCKING.has(vulnerability.severity) && !isAccepted) {
    blocking.push(line);
  } else {
    notBlocking.push(
      `${line}${inWebApps ? (isAccepted ? " [accepted upstream advisory, tracked]" : "") : " [not in the web apps' production tree]"}`
    );
  }
}

console.log(`Web apps' production packages checked: ${webPackages.size}`);
if (notBlocking.length) console.log(`\nNot blocking (${notBlocking.length}):\n  ${notBlocking.join("\n  ")}`);
if (blocking.length) {
  console.error(`\nBlocking: high/critical advisories in the web apps' production dependencies (${blocking.length}):\n  ${blocking.join("\n  ")}`);
  process.exit(1);
}
console.log("\nNo high or critical advisories in the web apps' production dependencies.");

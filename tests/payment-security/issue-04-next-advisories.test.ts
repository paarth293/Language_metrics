import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The payment routes run on Next.js. npm audit reported GHSA-3w37-wq28-93x7,
 * GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv, GHSA-f87g-xv8r-7p7x,
 * GHSA-mcj8-r9mp-w47p and GHSA-cjq9-62q9-8jv4, all fixed in 16.3.8.
 */
const PATCHED = [16, 3, 8];
const root = join(__dirname, "../..");
const manifests = ["package.json", "apps/student-web/package.json", "apps/teacher-web/package.json", "apps/admin-panel/package.json"];

const parse = (version: string) => version.replace(/^[^\d]*/, "").split(".").map(Number);
const atLeast = (version: string) => {
  const v = parse(version);
  for (let i = 0; i < 3; i++) if (v[i] !== PATCHED[i]) return (v[i] ?? 0) > PATCHED[i]!;
  return true;
};

describe("issue #4: Next.js is outside the advisory range", () => {
  it.each(manifests)("%s declares next >= 16.3.8", (manifest) => {
    const declared = JSON.parse(readFileSync(join(root, manifest), "utf8")).dependencies?.next;
    expect(declared, `${manifest} next`).toBeDefined();
    expect(atLeast(declared), `${manifest} declares ${declared}`).toBe(true);
  });

  it.each(["", "apps/student-web", "apps/teacher-web", "apps/admin-panel"])("the next installed for '%s' is >= 16.3.8", (workspace) => {
    const local = join(root, workspace, "node_modules/next/package.json");
    const installed = existsSync(local) ? local : join(root, "node_modules/next/package.json");
    const { version } = JSON.parse(readFileSync(installed, "utf8"));
    expect(atLeast(version), `installed next ${version}`).toBe(true);
  });
});

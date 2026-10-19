import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// #8d: auth and cron code logs through @repo/logger, so every line is JSON
// with a request ID and secrets masked. A bare console.* call skips both.
const ROOT = join(__dirname, "../../..");

const APPS = ["student-web", "teacher-web", "admin-panel"];
const DIRS = [
  ...APPS.flatMap((app) => [`apps/${app}/src/app/api/auth`, `apps/${app}/src/app/api/cron`]),
  "apps/student-web/src/app/api/v1/auth",
  "packages/auth/src",
];
const LIB_FILES = ["auth", "rate-limit", "redis-client", "redis-session", "email", "zoho-mailer"];
const FILES = APPS.flatMap((app) => LIB_FILES.map((name) => `apps/${app}/src/lib/${name}.ts`));

const isSource = (path: string) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path);

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : isSource(path) ? [path] : [];
  });
}

function sources(): string[] {
  const files = DIRS.flatMap((dir) => walk(join(ROOT, dir)));
  for (const file of FILES) {
    try {
      if (statSync(join(ROOT, file)).isFile()) files.push(join(ROOT, file));
    } catch {
      // not every app has every lib file
    }
  }
  return files;
}

describe("auth and cron paths use @repo/logger (#8d)", () => {
  it("scans a meaningful set of files", () => {
    expect(sources().length).toBeGreaterThan(40);
  });

  it("has no console.* calls", () => {
    const offenders = sources().flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(ROOT, file).replace(/\\/g, "/")}:${i + 1}` }))
        .filter(({ line }) => /\bconsole\.(log|info|warn|error|debug|trace)\b/.test(line))
        .map(({ at, line }) => `${at}  ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

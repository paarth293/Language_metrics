import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// .env.example is the one place a deployer learns what to set. This scans the
// server and package code of all three web apps (student-mobile has its own
// Expo config) and fails when a variable is read but not documented (#31).
const repoRoot = join(__dirname, "..", "..", "..");
const SOURCES = ["apps/student-web/src", "apps/teacher-web/src", "apps/admin-panel/src", "packages"];
/** Set by Node, Next or Vercel itself, not by a deployer. */
const RUNTIME = new Set(["NODE_ENV", "NEXT_RUNTIME", "VERCEL_ENV"]);

function sourceFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks fixed folders inside this repo.
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === ".next" || name === "dist") return [];
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is under a fixed repo folder.
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe(".env.example (#31)", () => {
  const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
  const documented = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));

  it("documents every environment variable the web apps and packages read", () => {
    const read = new Set<string>();
    for (const file of SOURCES.flatMap((dir) => sourceFiles(join(repoRoot, dir)))) {
      // Comments may mention a variable without reading it (e.g. admin-panel's totp.ts on JWT_SECRET).
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file comes from the walk above.
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const m of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*[A-Z0-9])\b/g)) read.add(m[1]!);
    }
    const missing = [...read].filter((name) => !RUNTIME.has(name) && !documented.has(name)).sort();
    expect(missing, `read but not in .env.example: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not document variables nothing reads", () => {
    expect(documented.has("JWT_SECRET")).toBe(false);
    // Join wrapped "# " comment lines so a sentence split across them still matches.
    expect(example.replace(/\r?\n#\s*/g, " ")).not.toMatch(/falls? back to JWT_SECRET/);
  });
});

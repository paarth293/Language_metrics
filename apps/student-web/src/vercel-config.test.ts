import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vercel reads vercel.json from the project's Root Directory (apps/<app>), so
// the cron fallback must live here, not at the repo root (#21).
const appRoot = join(__dirname, "..");
const repoRoot = join(appRoot, "..", "..");

describe("student-web vercel.json (#21)", () => {
  it("is in the app's root directory and the repo root has none", () => {
    expect(existsSync(join(appRoot, "vercel.json"))).toBe(true);
    expect(existsSync(join(repoRoot, "vercel.json"))).toBe(false);
  });

  it("registers both reconcile crons daily, each pointing at a real student-web route", () => {
    const config = JSON.parse(readFileSync(join(appRoot, "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };
    expect(config.crons).toEqual([
      { path: "/api/cron/reconcile-sessions", schedule: "0 0 * * *" },
      { path: "/api/cron/reconcile-payments", schedule: "30 0 * * *" },
    ]);
    for (const { path } of config.crons ?? []) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path comes from the committed vercel.json and stays under src/app.
      expect(existsSync(join(appRoot, "src", "app", ...path.split("/").filter(Boolean), "route.ts"))).toBe(true);
    }
  });

  it("does not pin a region (left to the Vercel dashboard)", () => {
    const config = JSON.parse(readFileSync(join(appRoot, "vercel.json"), "utf8")) as Record<string, unknown>;
    expect(config.regions).toBeUndefined();
  });
});

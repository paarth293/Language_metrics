/**
 * GET /api/health — for uptime monitors (#8f).
 *
 * 200 when the database and Redis (session store, rate limits) both answer
 * within 2 s, else 503. The body says only which dependency is down, never
 * why: error text can carry hostnames and connection strings. Public (the
 * proxy skips /api), and never cached.
 */
import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { log } from "@repo/logger";
import { pingSessionStore } from "@/lib/redis-session";

export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 2_000;

async function databaseUp(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("database probe timed out")), PROBE_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    log.warn("[health] database probe failed", { error });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([databaseUp(), pingSessionStore(PROBE_TIMEOUT_MS)]);
  const ok = database && redis;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", services: { database: database ? "up" : "down", redis: redis ? "up" : "down" } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

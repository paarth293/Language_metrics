import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { log } from "@repo/logger";

/** Compare without leaking length or position through timing. */
function sameSecret(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * GET /api/monitoring
 * Production health check endpoint. Returns system status.
 *
 * MONITORING_API_KEY is the only way in (#36). The old fallback accepted any
 * request whose Origin header merely contained the Host, which any non-browser
 * client can forge. With no key configured the endpoint stays closed.
 */
export async function GET(request: Request) {
  const apiKey = process.env.MONITORING_API_KEY;
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];

  if (!apiKey || !bearer || !sameSecret(bearer, apiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = {
      status: "healthy",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    // Never return the driver's message: it can carry hosts and credentials.
    log.error("[monitoring] database check failed", { error: err });
    checks.database = { status: "unhealthy" };
  }

  // 2. Redis check
  try {
    const redisStart = Date.now();
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      checks.redis = {
        status: "healthy",
        latencyMs: Date.now() - redisStart,
      };
    } else {
      checks.redis = { status: "not_configured" };
    }
  } catch (err) {
    log.error("[monitoring] redis check failed", { error: err });
    checks.redis = { status: "unhealthy" };
  }

  // 3. User counts
  try {
    const [studentCount, teacherCount, bookingCount] = await Promise.all([
      db.studentProfile.count(),
      db.teacherProfile.count(),
      db.booking.count({ where: { status: "CONFIRMED" } }),
    ]);
    checks.metrics = {
      status: "ok",
    };
    // Attach to response
    const metrics = { studentCount, teacherCount, activeBookings: bookingCount };
    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      metrics,
      latencyMs: totalTime,
    });
  } catch  {
    const totalTime = Date.now() - startTime;
    return NextResponse.json({
      status: "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      latencyMs: totalTime,
    });
  }
}

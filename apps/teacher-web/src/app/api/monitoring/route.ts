import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";

/**
 * GET /api/monitoring
 * Production health check endpoint. Returns system status.
 * Protected — only accessible with internal key or from same origin.
 */
export async function GET(request: Request) {
  // Simple API key check for production monitoring
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env.MONITORING_API_KEY;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Allow same-origin or if monitoring key matches
  const isSameOrigin = origin && host && origin.includes(host);
  const hasValidKey = apiKey && authHeader === `Bearer ${apiKey}`;

  if (!isSameOrigin && !hasValidKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = {
      status: "healthy",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    checks.database = {
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Unknown error",
    };
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
    checks.redis = {
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Unknown error",
    };
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
  } catch (err) {
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

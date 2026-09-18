import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "healthy";
  let redisStatus = "healthy";

  // 1. Probe Database Connectivity
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (err) {
    console.warn("[HealthCheck] Database probe degraded:", err);
    dbStatus = "degraded";
  }

  // 2. Probe Redis Cache
  try {
    const redis = getRedisClient();
    if (!redis) {
      redisStatus = "unconfigured_fallback";
    } else {
      await redis.ping();
    }
  } catch (err) {
    console.warn("[HealthCheck] Redis probe degraded:", err);
    redisStatus = "degraded_fallback";
  }

  const overallStatus = dbStatus === "healthy" ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
    { status: overallStatus === "healthy" ? 200 : 503 }
  );
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * student-web Edge Proxy (Next.js 16.3)
 *
 * Scope: ONLY the versioned mobile API (`/api/v1/*`).
 *
 * Why this exists
 * ───────────────
 * The student mobile app (apps/student-mobile) talks to `/api/v1/*` with a
 * Bearer token. Native iOS/Android builds are not subject to CORS, but the
 * Expo web target (`expo start --web`, http://localhost:8081) runs inside a
 * browser, which sends a CORS preflight (`OPTIONS`) before every request that
 * carries `Authorization` or `Content-Type: application/json`. Without an
 * `Access-Control-Allow-Origin` response header the browser blocks the call:
 *
 *   "Access to fetch at '.../api/v1/teachers' from origin 'http://localhost:8081'
 *    has been blocked by CORS policy"
 *
 * Security model
 * ──────────────
 * - `/api/v1/*` authenticates with `Authorization: Bearer <RS256 JWT>` only.
 *   It never reads cookies, so `Access-Control-Allow-Credentials` is NOT sent
 *   and cookie-based web routes (`/api/students/*`, `/api/auth/*`) are untouched.
 * - Origins are allow-listed, never `*`:
 *     • `MOBILE_WEB_ALLOWED_ORIGINS` (comma-separated) in every environment
 *     • Expo dev-server origins are added automatically when NODE_ENV !== "production"
 */

const DEV_EXPO_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type, Accept, X-Request-ID";
const PREFLIGHT_MAX_AGE_SECONDS = "600";

function getAllowedOrigins(): Set<string> {
  const configured = (process.env.MOBILE_WEB_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const origins = new Set(configured);
  if (process.env.NODE_ENV !== "production") {
    for (const o of DEV_EXPO_ORIGINS) origins.add(o);
  }
  return origins;
}

function applyCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", PREFLIGHT_MAX_AGE_SECONDS);
  // Responses differ per Origin — keep shared caches from mixing them up.
  response.headers.append("Vary", "Origin");
  return response;
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Same-origin / native mobile requests carry no Origin header: pass through.
  if (!origin) {
    return NextResponse.next();
  }

  const isAllowed = getAllowedOrigins().has(origin);

  if (request.method === "OPTIONS") {
    if (!isAllowed) {
      return new NextResponse(null, { status: 403 });
    }
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  const response = NextResponse.next();
  return isAllowed ? applyCorsHeaders(response, origin) : response;
}

export const config = {
  matcher: ["/api/v1/:path*"],
};

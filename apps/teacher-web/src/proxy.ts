import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, importSPKI } from "jose";

/**
 * teacher-web Edge Proxy (Next.js 16.3)
 *
 * Runs at the edge on every request. Handles:
 * 1. JWT auth verification for protected routes
 * 2. Rate limiting for auth endpoints (in-memory per isolate)
 * 3. Security headers (X-Request-ID, cache control)
 * 4. Silent refresh flow for expired tokens
 */

// ── Auth config ────────────────────────────────────────────────────────
const PROTECTED_PREFIXES = ["/student", "/teacher", "/dashboard", "/onboarding", "/profile"];
const EXCLUDED_PREFIXES = ["/api/", "/_next/", "/favicon"];
const ISSUER = "lm-auth";
const AUDIENCE = "lm-teacher-web";

// ── Rate limiter (in-memory, per-isolate) ──────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Prune old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > max;
}

// ── Helpers ────────────────────────────────────────────────────────────
async function getPublicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) return null;
  try {
    return await importSPKI(pem.replace(/\\\\n/g, "\n"), "RS256");
  } catch {
    return null;
  }
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ── Main proxy handler ─────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // ── 1. Skip excluded routes entirely ────────────────────────────────
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── 2. Rate limiting on auth endpoints ───────────────────────────────
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register/student" ||
    pathname === "/api/auth/register/teacher"
  ) {
    if (checkRateLimit(`auth:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { message: "Too many requests. Please wait and try again." },
        { status: 429 }
      );
    }
  }

  // General API rate limit
  if (pathname.startsWith("/api/")) {
    if (checkRateLimit(`api:${ip}`, 100, 60_000)) {
      return NextResponse.json(
        { message: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }
  }

  // ── CSRF protection for state-changing API routes ─────────────────────
  // Validate Origin header for POST/PUT/DELETE/PATCH to prevent CSRF
  const method = request.method.toUpperCase();
  if (pathname.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    // Allow requests with no origin (same-origin, curl, mobile apps)
    // Block cross-origin requests that don't match the host
    if (origin && host && !origin.includes(host)) {
      // Allow Google OAuth callback origins
      const allowedOrigins = [
        "accounts.google.com",
        "oauth2.googleapis.com",
        "www.googleapis.com",
      ];
      const isAllowed = allowedOrigins.some((o) => origin.includes(o));
      if (!isAllowed) {
        return NextResponse.json(
          { message: "Cross-origin request rejected." },
          { status: 403 }
        );
      }
    }
  }

  // ── 3. Security headers for all responses ────────────────────────────
  const response = isProtected(pathname)
    ? undefined // Will be set after auth check
    : NextResponse.next();

  if (response) {
    response.headers.set("X-Request-ID", crypto.randomUUID());
    response.headers.set("X-DNS-Prefetch-Control", "on");
  }

  // ── 4. Auth check on protected page routes ──────────────────────────
  if (!isProtected(pathname)) {
    const res = response ?? NextResponse.next();
    res.headers.set("X-Request-ID", crypto.randomUUID());
    return res;
  }

  const accessToken = request.cookies.get("lm_access_token")?.value;
  const refreshToken = request.cookies.get("lm_refresh_token")?.value;

  if (!accessToken) {
    if (refreshToken) {
      const refreshUrl = new URL("/api/auth/silent-refresh", request.url);
      refreshUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(refreshUrl);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the access token
  const publicKey = await getPublicKey();

  if (!publicKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Proxy] JWT_PUBLIC_KEY not set — allowing through in dev mode");
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(accessToken, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // Token valid — pass identity to server components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.sub ?? "");
    requestHeaders.set("x-user-role", (payload as { role?: string }).role ?? "");

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("X-Request-ID", crypto.randomUUID());
    return res;
  } catch {
    // Token invalid/expired
    if (refreshToken) {
      const refreshUrl = new URL("/api/auth/silent-refresh", request.url);
      refreshUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(refreshUrl);
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - api/* (all API routes handle their own auth)
     * - favicon.ico, brand assets
     */
    "/((?!_next/static|_next/image|api/|favicon.ico|brand).*)",
  ],
};

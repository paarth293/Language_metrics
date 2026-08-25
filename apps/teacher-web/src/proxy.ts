import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, importSPKI } from "jose";

/**
 * teacher-web Edge Middleware
 *
 * Runs at the edge on every request (before any server component or route handler).
 * Protects all routes under /student/*, /teacher/*, and /dashboard/* from unauthenticated access.
 *
 * Token verification uses the PUBLIC key only — edge-safe, no private key needed.
 * The full token rotation logic lives in /api/auth/refresh — we never do that here.
 *
 * Flow:
 *  - No access token cookie → redirect to /login
 *  - Invalid/expired access token + refresh cookie present → redirect to /api/auth/refresh?next=<path>
 *  - Invalid/expired + no refresh cookie → redirect to /login
 *  - Valid token → pass through with x-user-id and x-user-role headers set
 */

const PROTECTED_PREFIXES = ["/student", "/teacher", "/dashboard", "/onboarding", "/profile"];

const ISSUER = "lm-auth";
const AUDIENCE = "lm-teacher-web";

async function getPublicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) return null;
  try {
    return await importSPKI(pem.replace(/\\n/g, "\n"), "RS256");
  } catch {
    return null;
  }
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce auth on explicitly protected routes
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("lm_access_token")?.value;
  const refreshToken = request.cookies.get("lm_refresh_token")?.value;

  if (!accessToken) {
    // No token at all
    if (refreshToken) {
      // Has refresh token → try to silently refresh
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(refreshUrl);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the access token using the public key
  const publicKey = await getPublicKey();

  if (!publicKey) {
    // JWT_PUBLIC_KEY not configured (dev without RS256 setup) — allow through in dev
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Middleware] JWT_PUBLIC_KEY not set — skipping token verification in dev mode"
      );
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(accessToken, publicKey, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // Token is valid — pass user identity to server components via headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.sub ?? "");
    requestHeaders.set("x-user-role", (payload as { role?: string }).role ?? "");

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Token is invalid or expired
    if (refreshToken) {
      // Try silent refresh
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(refreshUrl);
    }

    // No valid token at all → clear cookie and redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, brand assets
     * This ensures middleware runs on all page routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|brand).*)",
  ],
};

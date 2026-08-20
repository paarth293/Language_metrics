import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight UX gate. The real authorization happens server-side in
// lib/guards.ts (requireAdmin), which re-verifies the JWT signature and reloads
// the admin's current status/role from the DB on every request. This middleware
// only skips work when a session cookie is clearly absent.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("lm_admin_session");
  const { pathname } = request.nextUrl;

  // Protect /api routes too: reject anything without a session cookie.
  if (pathname.startsWith("/api") && !hasSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasSession && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isPost = request.method === "POST";

  // CSRF Origin validation on POST (state-changing)
  if (isPost && isLogin) {
    const origin = request.headers.get("origin");
    if (!origin || !origin.includes("localhost:3001")) {
      return new NextResponse("Forbidden - Invalid Origin", { status: 403 });
    }
    
    // Rewrite POST /login to /api/login to avoid route/page conflict in App Router
    return NextResponse.rewrite(new URL("/api/login", request.url));
  }

  const payload = token ? await verifyAdminToken(token) : null;
  const isAuthed = payload?.role === "ADMIN";

  if (!isAuthed && !isLogin) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) {
      // Clear forgeable / expired cookie
      res.cookies.set(ADMIN_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return res;
  }

  if (isAuthed && isLogin && request.method === "GET") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const res = NextResponse.next();
  if (isLogin && request.method === "GET") {
    if (!request.cookies.has("csrf_token")) {
      const token = crypto.randomUUID().replace(/-/g, "");
      res.cookies.set("csrf_token", token, {
        httpOnly: false, // Must be readable by form JS if we were using client-side fetching, but here we just read it in Server Component
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      });
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"],
};

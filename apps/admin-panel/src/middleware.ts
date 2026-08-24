import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionEdge } from "@/lib/edge-auth";

export async function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Set the current pathname in a custom header so server components (guards.ts) can read it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  
  // Handle CSRF token setup and passing
  let csrfToken = request.cookies.get("csrf_token")?.value;
  if (!csrfToken) {
    csrfToken = crypto.randomUUID();
    requestHeaders.set("x-csrf-token", csrfToken);
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (requestHeaders.has("x-csrf-token")) {
    response.cookies.set("csrf_token", csrfToken, {
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
  if (!token && !isLoginPage) {
    response = NextResponse.redirect(new URL("/login", request.url));
  } else if (token) {
    // Token exists → verify its signature, issuer, audience, and expiry
    const result = await verifySessionEdge(token);

    if (!result.valid) {
      // Invalid/expired/forged token → clear cookie and redirect to login
      if (!isLoginPage) {
        response = NextResponse.redirect(new URL("/login", request.url));
      } else {
        // If already on login but token is invalid, we must preserve the custom header
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }
      response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

export const config = {
  // Apply middleware to all routes except api, _next/static, _next/image, and favicon/brand assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"],
};

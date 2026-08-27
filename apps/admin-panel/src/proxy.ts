import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifySession } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

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

  if (!token) {
    if (refreshToken && !isLoginPage) {
      // Missing access token but has refresh token -> silent refresh
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(refreshUrl);
    }
    
    if (!isLoginPage) {
      response = NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    // Token exists → verify its signature, issuer, audience, and expiry
    const result = await verifySession(token);

    if (!result) {
      // Invalid/expired/forged token
      if (refreshToken && !isLoginPage) {
        // Has refresh token -> silent refresh
        const refreshUrl = new URL("/api/auth/refresh", request.url);
        refreshUrl.searchParams.set("next", request.nextUrl.pathname);
        return NextResponse.redirect(refreshUrl);
      }

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
      response.cookies.set(ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
    } else {
      // Valid token -> inject sub/role into headers
      requestHeaders.set("x-user-id", result.sub);
      requestHeaders.set("x-user-role", result.roleKey);
    }
  }

  return response;
}

export const config = {
  // Apply middleware to all routes except api, _next/static, _next/image, and favicon/brand assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand).*)"],
};

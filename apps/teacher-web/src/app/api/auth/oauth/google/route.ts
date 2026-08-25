import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getGoogleAuthUrl } from "@/lib/oauth";

/**
 * GET /api/auth/oauth/google?role=student|teacher
 *
 * Redirects the user to the Google OAuth consent screen.
 * The `state` parameter is a random nonce stored in a cookie to prevent CSRF.
 * We embed the intended role in the state so the callback knows which profile to create.
 */
export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "student";
  if (role !== "student" && role !== "teacher") {
    return NextResponse.json({ message: "Invalid role." }, { status: 400 });
  }

  const nonce = crypto.randomUUID();
  const state = `${nonce}:${role}`;

  const authUrl = getGoogleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}

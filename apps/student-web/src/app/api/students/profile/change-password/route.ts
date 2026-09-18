import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { validateChangePassword } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { revokeAllRefreshSessions } from "@/lib/redis-session";

// POST - Change password
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  // SECURITY FIX: this route had no rate limit or body-size guard at all —
  // every other credential-adjacent endpoint in this app (login, logout)
  // limits attempts; a password-change endpoint that doesn't is exactly the
  // kind of thing an attacker automates to brute-force `currentPassword`
  // against a stolen session cookie / CSRF'd request.
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const userId = auth.user.sub;
  const isLimited = await rateLimitRedis(userId, "change-password", { windowMs: 60_000, max: 5 });
  if (isLimited) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // FIX: the old code destructured `currentPassword`/`newPassword` off the
    // body with no type check at all and called `newPassword.length < 8`
    // directly — a non-string `newPassword` (e.g. `123` or `null`) either
    // throws (500, logged as an "unexpected error" instead of a clean 400)
    // or, for values that happen to have a `.length`, silently passes a
    // bogus check. validateChangePassword() gives this the same explicit
    // shape guard every other mutating route in this app already has.
    const validation = validateChangePassword(body);
    if (!validation.ok) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword } = validation.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Hash and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // SECURITY FIX: previously nothing invalidated existing sessions after a
    // password change. If an attacker had already stolen a valid refresh
    // token (the actual reason a real user changes their password), the old
    // code let that stolen token go on minting fresh access tokens forever —
    // the password change accomplished nothing against the threat it exists
    // to defend against. request-deletion/route.ts already calls this same
    // helper after suspending an account; this brings change-password to the
    // same standard. The user's own current session re-authenticates via
    // their still-valid access token cookie (short-lived, unaffected) and
    // will get a fresh refresh session on next login.
    //
    // The password hash update above has already committed at this point, so
    // this is wrapped in its own try/catch (matching request-deletion's
    // pattern) — a hiccup while revoking sessions must never fall through to
    // the outer catch below and report "Failed to change password" to a user
    // whose password change actually succeeded.
    try {
      await revokeAllRefreshSessions(userId);
    } catch (revokeError) {
      console.error("Password changed, but session revocation failed:", revokeError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to change password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}

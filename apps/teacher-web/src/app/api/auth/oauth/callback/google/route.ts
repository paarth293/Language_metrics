import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exchangeGoogleCode } from "@/lib/oauth";
import { signAccessToken, signRefreshToken, accessCookieOptions, refreshCookieOptions } from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";
import { db } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/auth/oauth/callback/google?code=xxx&state=yyy
 *
 * Handles the Google OAuth callback:
 *  1. Validates state (CSRF protection).
 *  2. Exchanges code for Google user profile.
 *  3. Finds or creates the user + OAuthAccount + Profile.
 *  4. Issues httpOnly auth cookies.
 *  5. Redirects new users to /onboarding, returning users to their dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedNonce = request.cookies.get("oauth_state")?.value;

  // 1. Validate state parameter (CSRF protection)
  if (!code || !state || !storedNonce) {
    return NextResponse.redirect(new URL("/login?error=oauth_missing", APP_URL));
  }

  const [nonce, role] = state.split(":");
  if (nonce !== storedNonce || !["student", "teacher"].includes(role ?? "")) {
    return NextResponse.redirect(new URL("/login?error=oauth_invalid_state", APP_URL));
  }

  // 2. Exchange code for Google user profile
  let googleUser: { sub: string; email: string; name: string; picture?: string };
  try {
    googleUser = await exchangeGoogleCode(code);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "";
    if (errMsg === "GOOGLE_EMAIL_NOT_VERIFIED") {
      console.warn("[OAuth] Google account email is not verified.");
      return NextResponse.redirect(new URL("/login?error=oauth_email_unverified", APP_URL));
    }
    console.error("[OAuth] Google code exchange failed:", err);
    return NextResponse.redirect(new URL("/login?error=oauth_exchange_failed", APP_URL));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  let userId: string | null = null;
  let userRole: "STUDENT" | "TEACHER" = role === "teacher" ? "TEACHER" : "STUDENT";
  let isNewUser = false;

  // 3. Find existing OAuth account
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: googleUser.sub,
      },
    },
    include: {
      user: {
        select: {
          role: true,
          studentProfile: { select: { onboardingComplete: true } },
          teacherProfile: { select: { onboardingComplete: true } },
        },
      },
    },
  });

  if (existingOAuth) {
    // Returning user — check if they completed onboarding
    userId = existingOAuth.userId;
    userRole = existingOAuth.user.role as typeof userRole;
    const profile =
      userRole === "STUDENT"
        ? existingOAuth.user.studentProfile
        : existingOAuth.user.teacherProfile;
    isNewUser = !profile?.onboardingComplete;
  } else {
    // Check if a user exists with this email (account linking)
    const existingUser = await db.user.findUnique({
      where: { email: googleUser.email },
      select: {
        id: true,
        role: true,
        studentProfile: { select: { onboardingComplete: true } },
        teacherProfile: { select: { onboardingComplete: true } },
      },
    });

    if (existingUser) {
      // Role conflict: same email but user signed up under a different role
      // Example: signed up as STUDENT, now trying OAuth as TEACHER
      if (existingUser.role !== (role === "teacher" ? "TEACHER" : "STUDENT")) {
        const existingRoleLabel = existingUser.role.toLowerCase();
        return NextResponse.redirect(
          new URL(
            `/login?error=oauth_role_conflict&existing_role=${existingRoleLabel}`,
            APP_URL
          )
        );
      }

      // Link the OAuth account to the existing user
      userId = existingUser.id;
      userRole = existingUser.role as typeof userRole;
      await db.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: "google",
          providerAccountId: googleUser.sub,
        },
      });
      // Update avatar if not already set
      if (googleUser.picture) {
        if (userRole === "STUDENT") {
          await db.studentProfile.update({
            where: { userId: existingUser.id },
            data: { avatarUrl: googleUser.picture },
          });
        } else {
          await db.teacherProfile.update({
            where: { userId: existingUser.id },
            data: { avatarUrl: googleUser.picture },
          });
        }
      }
      const profile =
        userRole === "STUDENT" ? existingUser.studentProfile : existingUser.teacherProfile;
      isNewUser = !profile?.onboardingComplete;
    } else {
      // Brand new user — create account + placeholder profile
      const newUserId = crypto.randomUUID();
      const newRole = role === "teacher" ? "TEACHER" : "STUDENT";

      if (newRole === "STUDENT") {
        await db.user.create({
          data: {
            id: newUserId,
            email: googleUser.email,
            role: "STUDENT",
            emailVerified: true, // Google already verified the email
            studentProfile: {
              create: {
                name: googleUser.name,
                avatarUrl: googleUser.picture,
                languageToLearn: "", // Will be set during onboarding
                proficiencyLevel: "BEGINNER",
                onboardingComplete: false,
              },
            },
            oauthAccounts: {
              create: {
                provider: "google",
                providerAccountId: googleUser.sub,
              },
            },
          },
        });
      } else {
        await db.user.create({
          data: {
            id: newUserId,
            email: googleUser.email,
            role: "TEACHER",
            emailVerified: true,
            teacherProfile: {
              create: {
                name: googleUser.name,
                avatarUrl: googleUser.picture,
                status: "PENDING",
                experienceLevel: "FRESHER",
                language: "", // Will be set during onboarding
                onboardingComplete: false,
              },
            },
            oauthAccounts: {
              create: {
                provider: "google",
                providerAccountId: googleUser.sub,
              },
            },
          },
        });
      }
      userId = newUserId;
      userRole = newRole;
      isNewUser = true;
    }
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=oauth_user_error", APP_URL));
  }

  // 4. Issue auth cookies
  const sessionId = crypto.randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, userRole, true), // Google email is always verified
    signRefreshToken(userId, sessionId),
  ]);

  await storeRefreshSession(userId, sessionId, {
    ip: ip ?? undefined,
    ua: request.headers.get("user-agent") ?? undefined,
  });

  // 5. Redirect: new users → onboarding, returning users → dashboard
  let destination: string;
  if (isNewUser) {
    destination = "/onboarding";
  } else {
    // Returning user: send to role‑specific dashboard
    if (userRole === "STUDENT") {
      destination = "/student/dashboard";
    } else if (userRole === "TEACHER") {
      destination = "/teacher/dashboard";
    } else if (userRole === "ADMIN") {
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || (process.env.NODE_ENV === "production" ? "https://language-metrics-admin-panel.vercel.app" : "http://localhost:3001");
      destination = `${adminUrl}/dashboard`;
    } else {
      destination = "/coming-soon"; // fallback
    }
  }

  const redirectResponse = NextResponse.redirect(new URL(destination, APP_URL));
  redirectResponse.cookies.set("lm_access_token", accessToken, accessCookieOptions);
  redirectResponse.cookies.set("lm_refresh_token", refreshToken, {
    ...refreshCookieOptions,
    path: "/api/auth",
  });
  // Clear the OAuth state nonce
  redirectResponse.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });

  return redirectResponse;
}

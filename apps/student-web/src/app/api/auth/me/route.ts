import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Forced HMR reload trigger

import { verifyAccessToken, ACCESS_COOKIE } from "@/lib/tokens";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";
import { requestLogger } from "@repo/logger";

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile by verifying the lm_access_token cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload?.sub) {
      const res = NextResponse.json({ user: null }, { status: 200 });
      res.cookies.set(ACCESS_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }

    const cacheKey = `auth:me:v1:${payload.sub}`;
    return await withCache(cacheKey, 30_000, async () => {
      const user = await db.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          studentProfile: {
            select: {
              name: true,
              avatarUrl: true,
              languageToLearn: true,
              proficiencyLevel: true,
              onboardingComplete: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ user: null }, { status: 200, headers: { "x-skip-cache": "1" } });
      }

      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
            name: user.studentProfile?.name ?? "Student",
            avatarUrl: user.studentProfile?.avatarUrl ?? null,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      );
    });
  } catch (err) {
    requestLogger(request).error("GET /api/auth/me error", { error: err });
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { db } from "@/lib/db";

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile by verifying the lm_access_token cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("lm_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload?.sub) {
      const res = NextResponse.json({ user: null }, { status: 200 });
      res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
      return res;
    }

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
      return NextResponse.json({ user: null }, { status: 200 });
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
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/auth-mobile";

/**
 * GET /api/v1/me
 *
 * Returns student profile details and real-time coin balance for mobile app.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const userId = auth.user.id;

  try {
    const [user, profile, transactions] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      db.studentProfile.findUnique({
        where: { userId },
        select: {
          name: true,
          avatarUrl: true,
          languageToLearn: true,
          proficiencyLevel: true,
          status: true,
        },
      }),
      db.coinTransaction.findMany({
        where: { userId },
        select: { amount: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const coinBalance = transactions.reduce((acc, t) => acc + t.amount, 0);

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: profile?.name ?? "Student",
        avatarUrl: profile?.avatarUrl ?? null,
        languageToLearn: profile?.languageToLearn ?? "Spanish",
        proficiencyLevel: profile?.proficiencyLevel ?? "A1",
        status: profile?.status ?? "ACTIVE",
        coinBalance,
        joinedAt: user.createdAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Mobile API] Profile fetch error:", error);
    return NextResponse.json({ message: "Failed to fetch profile." }, { status: 500 });
  }
}

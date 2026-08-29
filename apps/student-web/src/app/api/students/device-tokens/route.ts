import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST - Register a device token for push notifications
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const body = await request.json();
    const { token: deviceToken, platform } = body;

    if (!deviceToken || !platform) {
      return NextResponse.json(
        { error: "Token and platform are required" },
        { status: 400 }
      );
    }

    // Upsert the device token (one per token)
    // await prisma.deviceToken.upsert({
    //   where: { token: deviceToken },
    //   update: { platform, userId },
    //   create: { token: deviceToken, platform, userId },
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to register device token:", error);
    return NextResponse.json(
      { error: "Failed to register device token" },
      { status: 500 }
    );
  }
}

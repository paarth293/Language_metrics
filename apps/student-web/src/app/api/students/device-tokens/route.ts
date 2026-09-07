import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateDeviceToken } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";

// POST - Register a device token for push notifications
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const isLimited = await rateLimitRedis(auth.user.sub, "device-tokens", { windowMs: 60_000, max: 20 });
  if (isLimited) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const userId = auth.user.sub;
    const body = await request.json();

    const validation = validateDeviceToken(body);
    if (!validation.ok) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }
    const { token: deviceToken, platform } = validation.data;

    // BUG FIX: this upsert was commented out, so this endpoint has never
    // actually saved a device token — it always returned { success: true }
    // and silently discarded the token. Push notifications for students
    // could never have worked; see errors.md for the full impact.
    await prisma.deviceToken.upsert({
      where: { token: deviceToken },
      update: { platform, userId },
      create: { token: deviceToken, platform, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to register device token:", error);
    return NextResponse.json(
      { error: "Failed to register device token" },
      { status: 500 }
    );
  }
}

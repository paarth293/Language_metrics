import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashOtp } from "@/lib/otp";
import { signResetSessionToken } from "@/lib/tokens";
import { getRedisClient } from "@/lib/redis-client";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp || typeof email !== "string" || typeof otp !== "string") {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const redis = getRedisClient();
    const attemptsKey = `pwreset:attempts:${emailLower}`;

    if (redis) {
      const attempts = await redis.get(attemptsKey);
      if (attempts && parseInt(attempts, 10) >= 5) {
        return NextResponse.json(
          { message: "Too many failed attempts. Please request a new code." },
          { status: 429 }
        );
      }
    }

    const user = await db.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        passwordResetToken: true,
        passwordResetExpiry: true,
      },
    });

    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return NextResponse.json({ message: "No pending reset request for this email." }, { status: 400 });
    }

    if (new Date() > user.passwordResetExpiry) {
      // Clean up expired tokens
      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      });
      return NextResponse.json({ message: "Reset code expired. Please request a new code." }, { status: 400 });
    }

    // Verify OTP
    // Note: OTPs are hashed using hashOtp (which uses bcrypt internally)
    // Wait, the prompt says `passwordResetToken (will store a bcrypt hash of the OTP)`.
    // In our `hashOtp` we did bcrypt.hash.
    // So we can use bcrypt.compare here. Wait, actually hashOtp returns a bcrypt hash?
    // Let me check my `hashOtp` implementation in `otp.ts` or just use bcrypt.compare if the DB stores bcrypt.
    // In `lib/otp.ts`, `hashOtp` does a bcrypt.hash(otp, 10). So we MUST use bcrypt.compare here, not `hashOtp(otp) !== dbHash`.
    const isValid = await bcrypt.compare(otp, user.passwordResetToken);

    if (!isValid) {
      if (redis) {
        // Expiry matches the OTP expiry window (10 minutes)
        await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, 600);
      }
      return NextResponse.json({ message: "Incorrect code." }, { status: 400 });
    }

    // Success! Issue a short-lived reset session token
    // We do NOT clear the DB token yet, because the actual reset step needs it.
    const resetSessionToken = await signResetSessionToken(user.id);

    return NextResponse.json({ success: true, resetSessionToken }, { status: 200 });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

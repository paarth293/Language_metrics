import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyResetSessionToken } from "@/lib/tokens";
import { getRedisClient } from "@/lib/redis-client";
import { resetPasswordSchema } from "@/features/auth/validators/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid inputs.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const { resetSessionToken, newPassword } = result.data;

    // Verify the short-lived signed JWT session token
    const payload = await verifyResetSessionToken(resetSessionToken);
    if (!payload) {
      return NextResponse.json(
        { message: "Reset session expired or invalid. Please request a new code." },
        { status: 400 }
      );
    }

    const userId = payload.sub;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordResetToken: true,
        passwordResetExpiry: true,
        emailVerified: true,
      },
    });

    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      return NextResponse.json(
        { message: "No pending reset request for this user." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { message: "Reset code expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update the password, clear the reset tokens, and verify email if not already verified
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        emailVerified: true,
      },
    });

    // Clear the Redis attempts counter
    const redis = getRedisClient();
    if (redis) {
      const attemptsKey = `pwreset:attempts:${user.email.toLowerCase().trim()}`;
      await redis.del(attemptsKey);
    }

    return NextResponse.json({ success: true, message: "Password updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("forgot-password reset error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

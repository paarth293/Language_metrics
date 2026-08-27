import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { hashOTP } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json(
      { message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp || typeof email !== "string" || typeof otp !== "string") {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        verificationCodes: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        studentProfile: true,
        teacherProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email is already verified." }, { status: 400 });
    }

    const verificationCode = user.verificationCodes[0];
    if (!verificationCode) {
      return NextResponse.json({ message: "No active verification code found." }, { status: 400 });
    }

    if (verificationCode.attempts >= 5) {
      return NextResponse.json(
        { message: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      );
    }

    if (verificationCode.expiresAt < new Date()) {
      return NextResponse.json(
        { message: "Verification code expired. Please request a new code." },
        { status: 400 }
      );
    }

    const submittedHash = hashOTP(otp);
    if (submittedHash !== verificationCode.codeHash) {
      // Increment attempts
      await db.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    // Success: Transaction to mark verified and delete code
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      db.emailVerificationCode.delete({
        where: { id: verificationCode.id },
      }),
    ]);

    const token = signToken(user.id, user.role, true);
    const name = user.studentProfile?.name || user.teacherProfile?.name || "User";

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("verify-email error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

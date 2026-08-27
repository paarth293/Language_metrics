import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  
  // Rate limit: 3 resends per 5 minutes per IP
  if (rateLimit(`resend:${ip}`, { windowMs: 5 * 60_000, max: 3 })) {
    return NextResponse.json(
      { message: "Too many requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        verificationCodes: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Do not reveal whether user exists
    if (!user || user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "If an account requires verification, a new verification code has been sent.",
      });
    }

    const lastCode = user.verificationCodes[0];
    if (lastCode) {
      // Cooldown of 60 seconds
      const elapsed = Date.now() - lastCode.createdAt.getTime();
      if (elapsed < 60_000) {
        return NextResponse.json({
          success: true,
          message: "If an account requires verification, a new verification code has been sent.",
        });
      }
    }

    // Clean up old codes
    await db.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    });

    // Generate new code
    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.emailVerificationCode.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
    });

    await sendVerificationOTP(user.email, otp);

    return NextResponse.json({
      success: true,
      message: "If an account requires verification, a new verification code has been sent.",
    });
  } catch (err) {
    console.error("resend-verification error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendPasswordResetOTP } from "@/lib/email";
import { getRedisClient } from "@/lib/redis-client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Valid email is required." }, { status: 400 });
    }
    
    const emailLower = email.toLowerCase().trim();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Rate limits
    const redis = getRedisClient();
    if (redis) {
      const cooldownKey = `pwreset:cooldown:${emailLower}`;
      const hourlyKey = `pwreset:hourly:${emailLower}`;
      const ipHourlyKey = `pwreset:ip-hourly:${ip}`;

      const [cooldown, hourly, ipHourly] = await Promise.all([
        redis.exists(cooldownKey),
        redis.get(hourlyKey),
        redis.get(ipHourlyKey),
      ]);

      if (cooldown === 1) {
        return NextResponse.json(
          { message: "Please wait a minute before requesting another code." },
          { status: 429 }
        );
      }
      if ((hourly && parseInt(hourly, 10) >= 5) || (ipHourly && parseInt(ipHourly, 10) >= 10)) {
        return NextResponse.json(
          { message: "Too many password reset requests. Please try again later." },
          { status: 429 }
        );
      }
    }

    const user = await db.user.findUnique({
      where: { email: emailLower },
      select: { id: true, email: true },
    });

    // Always return generic success to prevent email enumeration
    const genericResponse = NextResponse.json(
      { message: "If an account exists, a password reset code has been sent." },
      { status: 200 }
    );

    if (user) {
      const otp = generateOtp();
      const codeHash = await hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: codeHash,
          passwordResetExpiry: expiresAt,
        },
      });

      // Send email (blocking so Vercel doesn't kill it)
      await sendPasswordResetOTP(user.email, otp).catch(console.error);
    }

    // Update Redis rate limits
    if (redis) {
      const cooldownKey = `pwreset:cooldown:${emailLower}`;
      const hourlyKey = `pwreset:hourly:${emailLower}`;
      const ipHourlyKey = `pwreset:ip-hourly:${ip}`;
      
      const pipeline = redis.pipeline();
      pipeline.set(cooldownKey, "1", "EX", 60); // 60 second cooldown
      pipeline.incr(hourlyKey);
      pipeline.expire(hourlyKey, 3600);
      pipeline.incr(ipHourlyKey);
      pipeline.expire(ipHourlyKey, 3600);
      await pipeline.exec();
    }

    return genericResponse;
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

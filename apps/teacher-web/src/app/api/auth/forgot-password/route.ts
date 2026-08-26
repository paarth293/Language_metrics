import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, exceedsMaxBodySize } from "@/lib/rate-limit";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
}).strict();

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns 200 regardless of whether the email exists.
 * This prevents email enumeration attacks.
 */
export async function POST(request: NextRequest) {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Strict rate limit for password reset — 5 per 15 min per IP
  if (rateLimit(ip, { windowMs: 15 * 60_000, max: 5 })) {
    return NextResponse.json(
      { message: "Too many requests. Please try again in 15 minutes." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const result = forgotPasswordSchema.safeParse(body);
  if (!result.success) {
    // Still return 200 to prevent email oracle
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const { email } = result.data;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true, // null if OAuth-only account
      studentProfile: { select: { name: true } },
      teacherProfile: { select: { name: true } },
    },
  });

  // Only proceed if user exists AND has a password (OAuth-only users can't reset password)
  if (user && user.passwordHash) {
    const resetToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await bcrypt.hash(resetToken, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: expiry,
      },
    });

    const name = user.studentProfile?.name ?? user.teacherProfile?.name ?? "there";
    sendPasswordResetEmail(email, name, resetToken).catch((err) =>
      console.error("[Email] Failed to send password reset email:", err)
    );
  }

  // Always return 200 — never leak whether the email exists
  return NextResponse.json({ success: true }, { status: 200 });
}

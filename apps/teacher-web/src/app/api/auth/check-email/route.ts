import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { emailSchema } from "@/features/auth/validators/auth";
import { rateLimit } from "@/lib/rate-limit";
import { requestLogger } from "@repo/logger";

/**
 * GET /api/auth/check-email?email=...
 *
 * Checks whether an email address is available for registration.
 * Applies the global uniqueness rule across User (STUDENT, TEACHER, ADMIN)
 * and AdminUser models.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawEmail = searchParams.get("email");

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { available: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const parseResult = emailSchema.safeParse(rawEmail);
    if (!parseResult.success) {
      return NextResponse.json(
        { available: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const normalizedEmail = parseResult.data;

    // Rate limiting: 60 requests per minute per IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    if (rateLimit(`check-email:${ip}`, { windowMs: 60_000, max: 60 })) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Check database uniqueness across all accounts
    const [existingUser, existingAdmin] = await Promise.all([
      db.user?.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
      db.adminUser?.findUnique({
        where: { email: normalizedEmail },
        select: { userId: true },
      }),
    ]);

    if (existingUser || existingAdmin) {
      return NextResponse.json({
        available: false,
        code: "EMAIL_ALREADY_EXISTS",
        message:
          "This email is already registered. Please use another email address or sign in to your existing account.",
      });
    }

    return NextResponse.json({
      available: true,
    });
  } catch (error) {
    requestLogger(request).error("[Check Email] Unexpected error", { error });
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

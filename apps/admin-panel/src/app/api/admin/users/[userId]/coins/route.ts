import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api-auth";
import { assertSameOrigin } from "@/lib/security";
import { parseBody } from "@/lib/validators";
import { applyCoinAdjustment, coinAdjustmentSchema } from "@/lib/coin-adjustments";

// Manually credit or debit a student's or teacher's coins. All the money rules
// (step-up auth, limits, target checks, audit) live in lib/coin-adjustments.ts;
// this route only authenticates, parses and translates the result to HTTP.

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ message: "Invalid origin." }, { status: 403, headers: NO_STORE });
  }

  const auth = await requireApiAdmin(request, "coins:adjust");
  if (!auth.ok) return auth.response;

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ message: "User not found." }, { status: 404, headers: NO_STORE });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseBody(coinAdjustmentSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const h = request.headers;
  const result = await applyCoinAdjustment(auth.admin, userId, parsed.data, {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent") ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, code: result.code },
      { status: result.status, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ok: true, duplicate: result.duplicate, balance: result.balance },
    { headers: NO_STORE }
  );
}

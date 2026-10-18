/**
 * POST /api/admin/payments/:orderId/refund — refund a Cashfree order.
 *
 * Admin-only (`payments:refund`). The amount defaults to the full order and
 * can never exceed what was paid; one refund per order. See
 * refundPaymentOrder() in @repo/live-classes for the ordering guarantees.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { refundPaymentOrder, RefundError } from "@repo/live-classes";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refundSchema = z.object({
  /** Whole rupees. Omit for a full refund. */
  amountInr: z.number().int("Refund must be a whole number of rupees.").positive("Refund must be at least ₹1.").optional(),
  reason: z.string().trim().min(5, "Give a reason for the refund.").max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireApiAdmin(request, "payments:refund");
  if (!auth.ok) return auth.response;

  const { orderId } = await params;
  const parsed = refundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid refund request." }, { status: 400 });
  }

  try {
    const result = await refundPaymentOrder({ orderId, ...parsed.data, requestedBy: auth.admin.id });
    await auditLog(
      { adminId: auth.admin.id, ip: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") },
      "PAYMENT_REFUND_REQUESTED",
      orderId,
      { targetType: "PaymentOrder", refundId: result.refundId, amountInr: result.amountInr, reason: parsed.data.reason, status: result.status },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RefundError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error("[admin refund] failed:", error);
    return NextResponse.json({ message: "Refund could not be processed." }, { status: 500 });
  }
}

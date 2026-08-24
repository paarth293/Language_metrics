import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";
import { payoutStatusSchema, parseBody } from "@/lib/validators";

// Mark a payout as PAID/FAILED and record the UTR/reference. Money movement is
// fully audited; admins cannot silently alter the 70/30 split (that is computed
// from booking snapshots and only changed via Settings with the special
// permission).

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request, "payouts:manage");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parseBody(payoutStatusSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const payout = await db.payout.findUnique({ where: { id } });
  if (!payout) {
    return NextResponse.json({ message: "Payout not found." }, { status: 404 });
  }

  await db.payout.update({
    where: { id },
    data: {
      status: parsed.data.status,
      transactionRef: parsed.data.transactionRef ?? null,
    },
  });

  const h = request.headers;
  const ctx = {
    adminId: auth.admin.id,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };

  await auditLog(
    ctx,
    parsed.data.status === "PAID" ? "MARK_PAYOUT_PAID" : "MARK_PAYOUT_FAILED",
    id,
    { payoutId: id, transactionRef: parsed.data.transactionRef ?? null }
  );

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";

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
  const status = body?.status;
  if (!["PAID", "FAILED"].includes(status)) {
    return NextResponse.json({ message: "Invalid payout status." }, { status: 400 });
  }

  const payout = await db.payout.findUnique({ where: { id } });
  if (!payout) {
    return NextResponse.json({ message: "Payout not found." }, { status: 404 });
  }

  await db.payout.update({
    where: { id },
    data: {
      status,
      transactionRef: typeof body.transactionRef === "string" ? body.transactionRef : null,
    },
  });

  await auditLog(
    { adminId: auth.admin.id },
    status === "PAID" ? "MARK_PAYOUT_PAID" : "MARK_PAYOUT_FAILED",
    id,
    { payoutId: id, transactionRef: body.transactionRef ?? null }
  );

  return NextResponse.json({ ok: true, status });
}

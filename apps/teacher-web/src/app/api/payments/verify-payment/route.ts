import { NextResponse } from "next/server";
import { CashfreeError, PaymentError, verifyCoinPayment } from "@repo/live-classes";
import { requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "STUDENT");
    if (auth.error) return auth.error;
    // Cashfree is the source of truth; the browser only says which order to check.
    const { orderId } = await req.json();
    await verifyCoinPayment(auth.user.sub, orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentError || error instanceof CashfreeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { CashfreeError, PaymentError, verifyCoinPayment } from "@repo/live-classes";
import { requireAuth } from "@/lib/auth";
import { requestLogger } from "@repo/logger";
import { withServerErrorAlerts } from "@repo/logger/ops-alert";

// 5xx answers are counted for the repeated-5xx ops alert (#8e).
export const POST = withServerErrorAlerts("student-web payments/verify-payment", async (req: Request) => {
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
    requestLogger(req).error("payment verification failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

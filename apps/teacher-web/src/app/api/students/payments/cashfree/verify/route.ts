import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { verifyRecordingPayment, RecordingPaymentError } from "@repo/live-classes";
import { requestLogger } from "@repo/logger";
import { withServerErrorAlerts } from "@repo/logger/ops-alert";

// 5xx answers are counted for the repeated-5xx ops alert (#8e).
export const POST = withServerErrorAlerts("teacher-web students/payments/cashfree/verify", async (request: Request) => {
  try {
    const auth = await requireAuth(request, "STUDENT");
    if (auth.error) return auth.error;
    await verifyRecordingPayment(auth.user.sub, await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RecordingPaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    requestLogger(request).error("recording payment verification failed", { error });
    return NextResponse.json({ error: "Payment could not be processed" }, { status: 500 });
  }
});

import { NextResponse } from "next/server";
import { resolveCoinPackage } from "@repo/api-contracts";
import { CashfreeError, createCoinPaymentOrder } from "@repo/live-classes";
import { requireAuth } from "@/lib/auth";
import { requestLogger } from "@repo/logger";
import { withServerErrorAlerts } from "@repo/logger/ops-alert";

// 5xx answers are counted for the repeated-5xx ops alert (#8e).
export const POST = withServerErrorAlerts("student-web payments/create-order", async (req: Request) => {
  try {
    const auth = await requireAuth(req, "STUDENT");
    if (auth.error) return auth.error;

    // The price comes from the shared pack list, never from the browser.
    const pack = resolveCoinPackage(await req.json());
    if (!pack) return NextResponse.json({ error: "Invalid coin package or amount" }, { status: 400 });

    return NextResponse.json(await createCoinPaymentOrder(auth.user.sub, pack));
  } catch (error) {
    if (error instanceof CashfreeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    requestLogger(req).error("order creation failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

import { rateLimitRedis } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createRecordingPaymentOrder, RecordingPaymentError } from "@repo/live-classes";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, "STUDENT");
    if (auth.error) return auth.error;
    if (await rateLimitRedis(auth.user.sub, "recording-order", { windowMs: 60_000, max: 10 })) {
      return NextResponse.json({ error: "Too many payment attempts. Please wait." }, { status: 429 });
    }
    const body = await request.json();
    const result = await createRecordingPaymentOrder(auth.user.sub, body?.recordingId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RecordingPaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Recording payment order failed:", error);
    return NextResponse.json({ error: "Payment could not be processed" }, { status: 500 });
  }
}

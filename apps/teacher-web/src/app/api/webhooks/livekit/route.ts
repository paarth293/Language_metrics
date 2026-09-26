/**
 * POST /api/webhooks/livekit
 *
 * Point exactly ONE deployment's URL at this in the LiveKit Cloud dashboard
 * (Settings -> Webhooks). All three apps share a database, so a second
 * receiver would only duplicate work — harmless, thanks to the WebhookEvent
 * unique index, but pointless.
 *
 * Two things here are easy to get wrong and both are fatal:
 *
 *   1. The body must be read as raw TEXT. LiveKit signs the exact bytes it
 *      sent; parsing to JSON and re-stringifying changes them and every
 *      signature check fails.
 *   2. The route must run on the Node runtime. The Edge runtime lacks the
 *      crypto primitives livekit-server-sdk uses to verify the signature.
 */
import { NextRequest, NextResponse } from "next/server";
import { handleLiveKitWebhook } from "@repo/live-classes";
import { isLiveKitConfigured } from "@repo/livekit";
import { verifyWebhook } from "@repo/livekit/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Separate "we cannot verify" from "the signature is wrong" before touching
  // the body. verifyWebhook() asserts configuration internally and throws, so
  // without this a missing LIVEKIT_API_KEY surfaces in LiveKit's delivery log
  // as 401 Invalid signature — sending you to hunt a key mismatch that does
  // not exist. 500 is also the honest status: the fault is ours, and LiveKit
  // should retry once the deployment is configured rather than give up.
  if (!isLiveKitConfigured()) {
    console.error(
      "[livekit-webhook] LiveKit is not configured — set LIVEKIT_API_KEY, " +
        "LIVEKIT_API_SECRET and LIVEKIT_WS_URL (or LIVEKIT_URL) on this deployment."
    );
    return NextResponse.json(
      { message: "Webhook not configured." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const authHeader = request.headers.get("authorization");

  let event;
  try {
    event = await verifyWebhook(rawBody, authHeader);
  } catch (err) {
    console.error("[livekit-webhook] signature verification failed:", err);
    // 401, not 500: LiveKit should not retry something it signed wrongly.
    return NextResponse.json({ message: "Invalid signature." }, { status: 401 });
  }

  try {
    const result = await handleLiveKitWebhook(event);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[livekit-webhook] handler failed:", event.event, err);
    // 5xx makes LiveKit retry. The event row is left with processedAt null
    // and the error recorded, so the retry re-runs it cleanly.
    return NextResponse.json({ message: "Processing failed." }, { status: 500 });
  }
}

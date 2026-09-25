/**
 * DEPRECATED — forwards to POST /api/live/token.
 *
 * The old implementation called generateLiveKitToken(), which returned
 * `mock_token_<identity>_<room>_<timestamp>` whenever LIVEKIT_* env vars were
 * missing — and returned it with HTTP 200 and `configured: false` buried in
 * the body. A production deploy with a typo'd env var therefore looked
 * healthy while every teacher silently failed to connect.
 *
 * The replacement returns 503 NOT_CONFIGURED instead of a fake token.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleTokenRequest } from "@repo/live-classes";
import { isLiveKitConfigured } from "@repo/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  let body: { sessionId?: string; classSessionId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const classSessionId = body.classSessionId ?? body.sessionId;
  const result = await handleTokenRequest(
    { userId: auth.user.sub, role: auth.user.role },
    { classSessionId }
  );

  const payload =
    result.status === 200
      ? {
          ...(result.body as Record<string, unknown>),
          wsUrl: (result.body as { serverUrl: string }).serverUrl,
          configured: isLiveKitConfigured(),
        }
      : result.body;

  return NextResponse.json(payload, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store, private",
      Deprecation: "true",
      Link: '</api/live/token>; rel="successor-version"',
    },
  });
}

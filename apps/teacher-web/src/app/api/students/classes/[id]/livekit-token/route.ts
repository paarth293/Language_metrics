/**
 * DEPRECATED — forwards to POST /api/live/token.
 *
 * This endpoint used to build its own "token" as a plain string
 * (`dev-token-<userId>-<sessionId>` here, `mock_token_...` in the other app).
 * Neither was a LiveKit access token: unsigned, no room grant, no expiry. A
 * real LiveKit server rejects them, so live classes could never work in
 * production no matter how the environment was configured.
 *
 * Kept as a shim so already-deployed clients and any cached JS bundle keep
 * working. New code should call /api/live/token directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleTokenRequest } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT", "TEACHER", "ADMIN");
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const result = await handleTokenRequest(
    { userId: auth.user.sub, role: auth.user.role },
    { classSessionId: id }
  );

  // Old clients read `wsUrl`; the new contract returns `serverUrl`. Send both
  // so neither generation of client breaks during a rolling deploy.
  const body =
    result.status === 200
      ? { ...(result.body as Record<string, unknown>), wsUrl: (result.body as { serverUrl: string }).serverUrl }
      : result.body;

  return NextResponse.json(body, {
    status: result.status,
    headers: { "Cache-Control": "no-store, private", Deprecation: "true", Link: '</api/live/token>; rel="successor-version"' },
  });
}

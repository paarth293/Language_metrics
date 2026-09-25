/**
 * POST /api/live/token
 *
 * The single way into a live class, for students and teachers alike.
 *
 * Replaces two earlier endpoints that had drifted apart and, more
 * importantly, neither of which returned a real LiveKit token:
 *   - /api/students/classes/[id]/livekit-token  (returned `dev-token-<ids>`)
 *   - /api/teachers/session/token               (returned `mock_token_...`)
 * Both are now thin deprecation shims that forward here.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleTokenRequest } from "@repo/live-classes";
import { rateLimitRedis } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT", "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  // A client stuck in a reconnect loop can mint tokens as fast as it can ask.
  // Each successful join costs connection minutes, so this limit is a spend
  // control, not just abuse protection.
  const limited = await rateLimitRedis(auth.user.sub, "live-token", {
    windowMs: 60_000,
    max: 20,
  });
  if (limited) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "Too many join attempts. Wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const result = await handleTokenRequest(
    { userId: auth.user.sub, role: auth.user.role },
    (body ?? {}) as Record<string, unknown>
  );

  // Tokens are per-user secrets with a short life. Never let a CDN or the
  // browser cache one — a cached token handed to the next visitor would put
  // them in someone else's class.
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

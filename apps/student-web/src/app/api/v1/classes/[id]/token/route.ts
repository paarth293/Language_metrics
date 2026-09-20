/**
 * POST /api/v1/classes/[id]/token — mobile LiveKit token.
 *
 * Bearer-authenticated twin of /api/live/token, for the Expo app. Same
 * handler underneath, so the join window, budget gate and role resolution
 * cannot drift between mobile and web.
 *
 * The mobile client (`apps/student-mobile/src/lib/api-client.ts`) has had a
 * `getLiveKitToken()` method waiting on this route; its comment said "used
 * once the native video SDK ships". It has shipped.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth-mobile";
import { handleTokenRequest } from "@repo/live-classes";
import { LiveKitTokenResponseSchema } from "@repo/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let profile: unknown;
  try {
    const body = (await request.json()) as { profile?: unknown };
    profile = body?.profile;
  } catch {
    // Body optional.
  }

  const result = await handleTokenRequest(
    { userId: auth.user.id, role: "STUDENT" },
    { classSessionId: id, profile }
  );

  if (result.status !== 200) {
    return NextResponse.json(result.body, { status: result.status });
  }

  // Validate on the way out. The mobile client parses with the same schema,
  // so a mismatch should fail here — with a server log — rather than as an
  // opaque "invalid-response" on a student's phone.
  const parsed = LiveKitTokenResponseSchema.safeParse(result.body);
  if (!parsed.success) {
    console.error("[v1/classes/token] response failed contract:", parsed.error.issues);
    return NextResponse.json({ message: "Internal contract error." }, { status: 500 });
  }

  return NextResponse.json(parsed.data, {
    status: 200,
    headers: { "Cache-Control": "no-store, private" },
  });
}

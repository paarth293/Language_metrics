/**
 * POST/DELETE /api/live/[sessionId]/recording — start and stop egress.
 * Defaults to audio: a quarter the price of video for a language class.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleStartRecording, handleStopRecording } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request, "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  const { sessionId } = await params;
  let mode: "audio" | "video" = "audio";
  try {
    const body = (await request.json()) as { mode?: string };
    if (body?.mode === "video") mode = "video";
  } catch {
    // Body is optional; audio is the default and the cheap one.
  }

  const result = await handleStartRecording(
    { userId: auth.user.sub, role: auth.user.role },
    sessionId,
    mode
  );
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request, "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  const { sessionId } = await params;
  const result = await handleStopRecording(
    { userId: auth.user.sub, role: auth.user.role },
    sessionId
  );
  return NextResponse.json(result.body, { status: result.status });
}

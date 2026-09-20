/**
 * Legacy /session/[bookingId] route.
 *
 * Kept because links to it exist in emails and notifications already sent.
 * A booking can hold several sessions, so this resolves the one that is live
 * or next and forwards to the canonical /live/[sessionId] page.
 */
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LegacySessionPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const session =
    (await db.classSession.findFirst({
      where: { bookingId, status: "ONGOING" },
      orderBy: { scheduledStart: "asc" },
      select: { id: true },
    })) ??
    (await db.classSession.findFirst({
      where: { bookingId, status: "SCHEDULED" },
      orderBy: { scheduledStart: "asc" },
      select: { id: true },
    }));

  if (!session) redirect("/teacher/sessions");
  redirect(`/live/${session.id}`);
}

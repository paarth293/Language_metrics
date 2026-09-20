/**
 * Student live class page.
 *
 * Replaces the previous placeholder, which rendered a static "Waiting for
 * teacher to join..." panel, a fake self-view and a chat box whose messages
 * were pushed into local state and never sent anywhere. No LiveKit client was
 * involved at any point.
 *
 * The route param is the ClassSession id — the same id the booking API
 * returns as `sessionId`.
 */
import LiveClassroom from "@/components/live/LiveClassroom";

export const dynamic = "force-dynamic";

export default async function LiveClassPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <LiveClassroom classSessionId={sessionId} exitHref="/classes" />;
}

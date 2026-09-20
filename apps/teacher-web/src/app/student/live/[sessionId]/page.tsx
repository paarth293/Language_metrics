/**
 * Student-facing live class inside teacher-web.
 * Same component; only the exit link differs.
 */
import LiveClassroom from "@/components/live/LiveClassroom";

export const dynamic = "force-dynamic";

export default async function StudentLivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <LiveClassroom classSessionId={sessionId} exitHref="/student/classes" />;
}

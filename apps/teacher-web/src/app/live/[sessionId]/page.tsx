/**
 * Live class page for teacher-web.
 *
 * One route for both roles: the server derives TEACHER or STUDENT from the
 * booking rather than from the URL, so a student who lands here gets student
 * grants and a teacher gets moderator grants. That removes the class of bug
 * where a role is inferred from which page someone opened.
 */
import LiveClassroom from "@/components/live/LiveClassroom";

export const dynamic = "force-dynamic";

export default async function LivePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <LiveClassroom classSessionId={sessionId} exitHref="/teacher/sessions" />;
}

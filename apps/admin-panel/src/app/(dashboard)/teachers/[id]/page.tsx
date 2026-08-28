import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { updateTeacherStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function TeacherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: id },
    include: {
      user: true,
      documents: true,
    }
  });

  if (!teacher) {
    return notFound();
  }

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/teachers" className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{teacher.name}&apos;s Profile</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text-muted)" }}>Teacher Management</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>{teacher.name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Email</p>
                <p className="text-white">{teacher.user.email}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Gender</p>
                <p className="text-white">{teacher.gender || "Not specified"}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Experience Level</p>
                <p className="text-white capitalize">{teacher.experienceLevel.toLowerCase()}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Primary Language</p>
                <p className="text-white capitalize">{teacher.language?.replace(/_/g, " ") || "Not specified"}</p>
              </div>
            </div>
            {(teacher.languages && teacher.languages.length > 0) && (
              <div className="mt-3">
                <p className="text-gray-500 mb-1 text-sm">All Languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.languages.map((lang: string) => (
                    <span key={lang} className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-300 border border-indigo-700/30">
                      {lang.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-3">
              <p className="text-gray-500 mb-1 text-sm">Bio</p>
              <p className="text-white text-sm bg-gray-800/50 p-3 rounded">{teacher.bio || "No bio provided."}</p>
            </div>
          </div>

          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Verification Documents</h2>
            {teacher.documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded.</p>
            ) : (
              <ul className="space-y-3">
                {teacher.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {doc.type === "EDUCATION" ? "🎓 Qualification Certificate" :
                         doc.type === "ID_PROOF" ? "🪪 ID Proof" :
                         doc.type === "EXPERIENCE_LETTER" ? "💼 Experience Document" :
                         doc.type === "LANGUAGE_CERTIFICATE" ? "📜 Language Certificate" :
                         doc.type}
                      </p>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline">View Document</a>
                    </div>
                    <div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        doc.status === 'APPROVED' ? 'bg-green-900/30 text-green-400' :
                        doc.status === 'REJECTED' ? 'bg-red-900/30 text-red-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Admin Actions</h2>
            <div className="mb-6 pb-6 border-b border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Current Status:</p>
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                  teacher.status === 'APPROVED' ? 'bg-green-900/50 text-green-400 border border-green-500/30' :
                  teacher.status === 'REJECTED' ? 'bg-red-900/50 text-red-400 border border-red-500/30' :
                  'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {teacher.status}
              </span>
            </div>

            <div className="space-y-3">
              <form action={async () => {
                "use server";
                await updateTeacherStatus(teacher.userId, "APPROVED");
              }}>
                <button type="submit" disabled={teacher.status === 'APPROVED'} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle size={16} /> Approve Teacher
                </button>
              </form>
              
              <form action={async () => {
                "use server";
                await updateTeacherStatus(teacher.userId, "REJECTED");
              }}>
                <button type="submit" disabled={teacher.status === 'REJECTED'} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <XCircle size={16} /> Reject / Suspend
                </button>
              </form>
              
              <form action={async () => {
                "use server";
                await updateTeacherStatus(teacher.userId, "INTERVIEW_SCHEDULED");
              }}>
                <button type="submit" disabled={teacher.status === 'INTERVIEW_SCHEDULED'} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Clock size={16} /> Schedule Interview
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

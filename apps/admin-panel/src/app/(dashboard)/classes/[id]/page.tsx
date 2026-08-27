import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, CheckCircle, XCircle } from "lucide-react";
import { updateSessionStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      student: true,
      teacher: true,
      sessions: { orderBy: { scheduledStart: 'asc' } }
    }
  });

  if (!booking) {
    return notFound();
  }

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/classes" className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Booking #{booking.id.split('-')[0].toUpperCase()}</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text-muted)" }}>Classes</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>{booking.id.split('-')[0].toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Booking Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Teacher</p>
                <p className="text-white font-medium">{booking.teacher.name}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Student</p>
                <p className="text-white font-medium">{booking.student.name}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Type</p>
                <p className="text-white uppercase">{booking.type}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                <p className={`font-semibold ${
                  booking.status === 'COMPLETED' ? 'text-green-400' :
                  booking.status === 'CANCELLED' ? 'text-red-400' : 'text-indigo-400'
                }`}>{booking.status}</p>
              </div>
            </div>
          </div>

          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Class Sessions</h2>
            {booking.sessions.length === 0 ? (
              <p className="text-sm text-gray-400">No sessions scheduled.</p>
            ) : (
              <ul className="space-y-4">
                {booking.sessions.map((session, index) => (
                  <li key={session.id} className="p-4 bg-gray-800 rounded border border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white mb-1">Session {index + 1}</p>
                        <p className="text-xs text-gray-400">
                          Scheduled: {session.scheduledStart.toLocaleString()} - {session.scheduledEnd.toLocaleTimeString()}
                        </p>
                        {session.recordingUrl && (
                          <a href={session.recordingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 mt-2 hover:underline">
                            <Video size={14} /> View Recording
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          session.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                          session.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400' :
                          'bg-yellow-900/30 text-yellow-400'
                        }`}>
                          {session.status}
                        </span>
                        
                        {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
                          <div className="flex items-center gap-1 ml-4 border-l border-gray-700 pl-4">
                            <form action={async () => {
                              "use server";
                              await updateSessionStatus(session.id, booking.id, "COMPLETED");
                            }}>
                              <button type="submit" className="p-1.5 bg-gray-700 hover:bg-green-600 text-gray-300 hover:text-white rounded transition-colors" title="Mark Completed">
                                <CheckCircle size={14} />
                              </button>
                            </form>
                            <form action={async () => {
                              "use server";
                              await updateSessionStatus(session.id, booking.id, "CANCELLED");
                            }}>
                              <button type="submit" className="p-1.5 bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white rounded transition-colors" title="Cancel Session">
                                <XCircle size={14} />
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Financial Snapshots</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">Total Paid</span>
                <span className="text-white font-medium">{(booking.amountPaid / 100).toFixed(2)} INR</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">LM Commission ({booking.commissionPct}%)</span>
                <span className="text-white font-medium">{(booking.commissionAmount / 100).toFixed(2)} INR</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-400">Teacher Earnings</span>
                <span className="text-green-400 font-medium">{(booking.teacherEarnings / 100).toFixed(2)} INR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, RefreshCw } from "lucide-react";
import { updateComplaintStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const complaintData = await db.complaint.findUnique({
    where: { id }
  });

  if (!complaintData) {
    return notFound();
  }

  const student = complaintData.studentId ? await db.studentProfile.findUnique({ where: { userId: complaintData.studentId } }) : null;
  const teacher = complaintData.teacherId ? await db.teacherProfile.findUnique({ where: { userId: complaintData.teacherId } }) : null;
  const booking = complaintData.bookingId ? await db.booking.findUnique({ where: { id: complaintData.bookingId } }) : null;

  const complaint = {
    ...complaintData,
    student: student || { name: 'Unknown' },
    teacher: teacher || { name: 'Unknown' },
    booking: booking || null,
  };

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/complaints" className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Ticket #{complaint.id.split('-')[0].toUpperCase()}</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text-muted)" }}>Complaints</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>{complaint.id.split('-')[0].toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">{complaint.subject || "No Subject Provided"}</h2>
                <p className="text-sm text-gray-400 mt-1">Submitted on {complaint.createdAt.toLocaleString()}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' ? 'bg-green-900/30 text-green-400 border border-green-900/50' :
                complaint.status === 'ACTION_REQUIRED' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50'
              }`}>
                {complaint.status.replace('_', ' ')}
              </span>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded p-4 text-sm text-gray-200 whitespace-pre-wrap">
              {complaint.description || "No description provided."}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
              <div className="border border-gray-700 rounded p-3">
                <p className="text-gray-500 mb-1 text-xs uppercase font-semibold tracking-wider">Submitted By (Student)</p>
                <p className="text-white">{complaint.student.name}</p>
                <Link href={`/students/${complaint.studentId}`} className="text-indigo-400 hover:underline text-xs mt-1 inline-block">View Profile</Link>
              </div>
              <div className="border border-gray-700 rounded p-3">
                <p className="text-gray-500 mb-1 text-xs uppercase font-semibold tracking-wider">Against (Teacher)</p>
                <p className="text-white">{complaint.teacher.name}</p>
                <Link href={`/teachers/${complaint.teacherId}`} className="text-indigo-400 hover:underline text-xs mt-1 inline-block">View Profile</Link>
              </div>
            </div>
            
            {complaint.bookingId && (
              <div className="mt-4 border border-gray-700 rounded p-3 text-sm">
                <p className="text-gray-500 mb-1 text-xs uppercase font-semibold tracking-wider">Related Booking</p>
                <Link href={`/classes/${complaint.bookingId}`} className="text-indigo-400 hover:underline">
                  View Booking #{complaint.bookingId.split('-')[0].toUpperCase()}
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Ticket Actions</h2>
            <div className="space-y-3">
              <form action={async () => {
                "use server";
                await updateComplaintStatus(complaint.id, "INVESTIGATING");
              }}>
                <button type="submit" disabled={complaint.status === 'INVESTIGATING'} className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <RefreshCw size={16} /> Mark Investigating
                </button>
              </form>
              
              <form action={async () => {
                "use server";
                await updateComplaintStatus(complaint.id, "RESOLVED");
              }}>
                <button type="submit" disabled={complaint.status === 'RESOLVED' || complaint.status === 'CLOSED'} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <CheckCircle size={16} /> Resolve Ticket
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

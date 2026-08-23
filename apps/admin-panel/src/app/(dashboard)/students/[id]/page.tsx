import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, PlayCircle, AlertOctagon } from "lucide-react";
import { updateStudentStatus } from "./actions";

export const dynamic = 'force-dynamic';

export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { id } = params;

  const student = await db.studentProfile.findUnique({
    where: { userId: id },
    include: {
      user: {
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 5 }
        }
      },
      bookings: {
        include: { teacher: true, sessions: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!student) {
    return notFound();
  }

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/students" className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{student.name}&apos;s Profile</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text-muted)" }}>Student Management</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>{student.name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Basic Info */}
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Email</p>
                <p className="text-white">{student.user.email}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Joined On</p>
                <p className="text-white">{student.user.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Target Language</p>
                <p className="text-white">{student.languageToLearn}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Proficiency Level</p>
                <p className="text-white capitalize">{student.proficiencyLevel.toLowerCase()}</p>
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Bookings / Classes</h2>
            {student.bookings.length === 0 ? (
              <p className="text-sm text-gray-400">No bookings yet.</p>
            ) : (
              <div className="space-y-4">
                {student.bookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-800 rounded border border-gray-700 gap-3">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{booking.type.toLowerCase()} Class</p>
                      <p className="text-xs text-gray-400 mt-1">Teacher: {booking.teacher.name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        booking.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                        booking.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400' :
                        'bg-indigo-900/30 text-indigo-400'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Admin Actions */}
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Admin Actions</h2>
            <div className="mb-6 pb-6 border-b border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Account Status:</p>
              <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                  student.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400 border border-green-500/30' :
                  student.status === 'SUSPENDED' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30' :
                  'bg-red-900/50 text-red-400 border border-red-500/30'
                }`}>
                  {student.status}
              </span>
            </div>

            <div className="space-y-3">
              <form action={async () => {
                "use server";
                await updateStudentStatus(student.userId, "ACTIVE");
              }}>
                <button type="submit" disabled={student.status === 'ACTIVE'} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <PlayCircle size={16} /> Reactivate Account
                </button>
              </form>
              
              <form action={async () => {
                "use server";
                await updateStudentStatus(student.userId, "SUSPENDED");
              }}>
                <button type="submit" disabled={student.status === 'SUSPENDED'} className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <AlertOctagon size={16} /> Suspend Student
                </button>
              </form>
              
              <form action={async () => {
                "use server";
                await updateStudentStatus(student.userId, "BLOCKED");
              }}>
                <button type="submit" disabled={student.status === 'BLOCKED'} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Ban size={16} /> Block Student
                </button>
              </form>
            </div>
          </div>
          
          {/* Payment History Preview */}
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-md font-semibold text-white mb-4">Recent Payments</h2>
            {student.user.payments.length === 0 ? (
               <p className="text-sm text-gray-400">No payments yet.</p>
            ) : (
              <ul className="space-y-3">
                {student.user.payments.map(payment => (
                  <li key={payment.id} className="text-sm border-b border-gray-700 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between text-white">
                      <span>{(payment.amount / 100).toFixed(2)} INR</span>
                      <span className="text-gray-400">{payment.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 capitalize">{payment.type.toLowerCase().replace('_', ' ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

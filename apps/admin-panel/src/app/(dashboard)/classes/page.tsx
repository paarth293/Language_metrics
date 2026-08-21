import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { Filter } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requireAdmin();
  const filter = searchParams.filter || "upcoming";

  let statusFilter: any = "SCHEDULED";
  if (filter === "ongoing") statusFilter = "ONGOING";
  else if (filter === "completed") statusFilter = "COMPLETED";
  else if (filter === "cancelled") statusFilter = "CANCELLED";

  const bookings = await db.booking.findMany({
    where: filter === "all" ? {} : { status: statusFilter },
    include: {
      student: true,
      teacher: true,
      sessions: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  const activeTabStyle = "border-b-2 border-indigo-500 text-indigo-400 font-medium";
  const inactiveTabStyle = "text-gray-400 hover:text-gray-300 transition-colors";

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Class / Booking Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Classes</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm overflow-x-auto">
          <Link href="/classes?filter=all" className={`pb-3 px-1 whitespace-nowrap ${filter === 'all' ? activeTabStyle : inactiveTabStyle}`}>All Bookings</Link>
          <Link href="/classes?filter=upcoming" className={`pb-3 px-1 whitespace-nowrap ${filter === 'upcoming' ? activeTabStyle : inactiveTabStyle}`}>Upcoming</Link>
          <Link href="/classes?filter=ongoing" className={`pb-3 px-1 whitespace-nowrap ${filter === 'ongoing' ? activeTabStyle : inactiveTabStyle}`}>Ongoing</Link>
          <Link href="/classes?filter=completed" className={`pb-3 px-1 whitespace-nowrap ${filter === 'completed' ? activeTabStyle : inactiveTabStyle}`}>Completed</Link>
          <Link href="/classes?filter=cancelled" className={`pb-3 px-1 whitespace-nowrap ${filter === 'cancelled' ? activeTabStyle : inactiveTabStyle}`}>Cancelled</Link>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Booking ID</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Teacher</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Student</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Type</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Status</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3.5 px-5 text-[13px] text-gray-400 font-mono">
                    {booking.id.split('-')[0].toUpperCase()}
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-white">{booking.teacher.name}</td>
                  <td className="py-3.5 px-5 text-[13px] text-white">{booking.student.name}</td>
                  <td className="py-3.5 px-5">
                    <span className="bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded text-[11px] uppercase font-medium">
                      {booking.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      booking.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                      booking.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400' :
                      'bg-indigo-900/30 text-indigo-400'
                    }`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/classes/${booking.id}`}
                      style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                      className="inline-block px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500 text-sm">No classes found matching this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

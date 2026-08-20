import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function RecordingsPage() {
  await requireAdmin();
  const sessions = await db.classSession.findMany({
    where: { recordingUrl: { not: null } },
    include: { booking: true },
    orderBy: { scheduledStart: "desc" },
    take: 100,
  });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Class Recordings</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Review recordings and apply retention rules.</p>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Class ID", "Booking", "Date", "Recording", "Action"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-accent)" }} className="py-3.5 px-5 text-[13px] font-bold">{c.id.slice(0, 8).toUpperCase()}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.bookingId.slice(0, 8).toUpperCase()}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.scheduledStart.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ color: "var(--lm-ok)" }} className="py-3.5 px-5 text-[13px] font-medium">Available</td>
                  <td className="py-3.5 px-5">
                    <button style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }} className="px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">View</button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No recordings available yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

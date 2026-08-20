import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  await requireAdmin();
  const reviews = await db.review.findMany({
    include: { teacher: true, student: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Reviews & Ratings</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Moderate reviews. Admins cannot silently alter ratings.</p>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Teacher", "Student", "Rating", "Comment", "Action"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px] font-medium">{r.teacher.name}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{r.student.name}</td>
                  <td className="py-3.5 px-5">{"★".repeat(r.rating)}<span style={{ color: "var(--lm-text-subtle)" }}>{"☆".repeat(5 - r.rating)}</span></td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px] max-w-[300px] truncate">{r.comment ?? "—"}</td>
                  <td className="py-3.5 px-5">
                    <button style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }} className="px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">Moderate</button>
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr><td colSpan={5} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No reviews yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

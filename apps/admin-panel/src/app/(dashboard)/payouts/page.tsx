import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function PayoutsPage({ searchParams }: { searchParams: { filter?: string } }) {
  await requireAdmin();

  const filter = searchParams.filter || "pending";
  
  let statusFilter: any = "PENDING";
  if (filter === "paid") statusFilter = "PAID";
  else if (filter === "failed") statusFilter = "FAILED";

  const payouts = await db.payout.findMany({
    where: filter === "all" ? {} : { status: statusFilter },
    include: {
      teacher: true,
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
          <h1 className="text-2xl font-bold text-white mb-1">Teacher Payouts</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Payouts</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm overflow-x-auto">
          <Link href="/payouts?filter=all" className={`pb-3 px-1 whitespace-nowrap ${filter === 'all' ? activeTabStyle : inactiveTabStyle}`}>All Payouts</Link>
          <Link href="/payouts?filter=pending" className={`pb-3 px-1 whitespace-nowrap ${filter === 'pending' ? activeTabStyle : inactiveTabStyle}`}>Pending</Link>
          <Link href="/payouts?filter=paid" className={`pb-3 px-1 whitespace-nowrap ${filter === 'paid' ? activeTabStyle : inactiveTabStyle}`}>Paid</Link>
          <Link href="/payouts?filter=failed" className={`pb-3 px-1 whitespace-nowrap ${filter === 'failed' ? activeTabStyle : inactiveTabStyle}`}>Failed</Link>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Payout ID</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Teacher</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Amount</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Status</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Generated On</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3.5 px-5 text-[13px] text-gray-400 font-mono">
                    {payout.id.split('-')[0].toUpperCase()}
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="text-[13px] font-medium text-white">{payout.teacher.name}</p>
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-white">{(payout.amount / 100).toFixed(2)}</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      payout.status === 'PAID' ? 'bg-green-900/30 text-green-400' :
                      payout.status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-gray-400">{payout.createdAt.toLocaleDateString()}</td>
                  <td className="py-3.5 px-5 text-right">
                    {payout.status === 'PENDING' ? (
                       <form action={async () => {
                         "use server";
                         await db.payout.update({ where: { id: payout.id }, data: { status: 'PAID' } });
                       }}>
                         <button type="submit" className="inline-flex items-center gap-1 bg-green-900/50 hover:bg-green-600 text-green-400 hover:text-white px-3 py-1 rounded text-[12px] font-medium transition-colors border border-green-900">
                           <CheckCircle size={14} /> Mark Paid
                         </button>
                       </form>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500 text-sm">No payouts found matching this filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import Link from "next/link";
import { Search } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireAdmin();

  const q = searchParams.q || "";

  const payments = await db.payment.findMany({
    include: {
      user: true,
      booking: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Payments & Revenue Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Payments</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm overflow-x-auto">
          <Link href="/payments" className="pb-3 px-1 border-b-2 border-indigo-500 text-indigo-400 font-medium">All Transactions</Link>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Order ID</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Student</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Total Paid</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">LM Share</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Teacher Share</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Status</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const isBooking = !!payment.booking;
                const lmShare = isBooking ? payment.booking!.commissionAmount : payment.amount;
                const teacherShare = isBooking ? payment.booking!.teacherEarnings : 0;
                
                return (
                  <tr key={payment.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-3.5 px-5 text-[13px] text-gray-400 font-mono">
                      {payment.id.split('-')[0].toUpperCase()}
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-[13px] font-medium text-white">{payment.user.name}</p>
                      <p className="text-[11px] text-gray-500">{payment.user.email}</p>
                    </td>
                    <td className="py-3.5 px-5 text-[13px] text-white">{(payment.amount / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-5 text-[13px] text-indigo-400">{(lmShare / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-5 text-[13px] text-green-400">{(teacherShare / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        payment.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' :
                        payment.status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Link
                        href={`/payments/${payment.id}`}
                        style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                        className="inline-block px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-gray-500 text-sm">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

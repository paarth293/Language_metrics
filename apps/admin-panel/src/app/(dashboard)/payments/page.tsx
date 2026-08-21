import { Inbox } from "lucide-react";
import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";

export const dynamic = 'force-dynamic';

export default async function PaymentsPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const [payments, totalCount] = await Promise.all([
    db.payment.findMany({
      select: {
        id: true,
        amount: true,
        status: true,
        user: { select: { email: true, role: true } },
        booking: { select: { commissionAmount: true, teacherEarnings: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    db.payment.count()
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusStyle = (status: string) => {
    if (status === 'SUCCESS') return "lm-status lm-status--teal";
    if (status === 'FAILED') return "lm-status lm-status--red";
    return "lm-status lm-status--amber";
  };

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
            <span>Dashboard</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Payments</span>
          </div>
          <h1 className="lm-page-title">Payments & Revenue Management</h1>
          <p className="lm-body-copy mt-2">Monitor transactions, track platform commissions, and manage teacher earnings.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--lm-line)]">
          <nav aria-label="Payment views" className="flex min-w-0 gap-6 overflow-x-auto">
            <Link href="/payments" aria-current="page" className="border-b-2 border-[var(--lm-teal)] px-1 pb-3 text-[12px] font-semibold text-[var(--lm-teal-deep)] transition-colors">
              All Transactions
            </Link>
          </nav>
        </div>
      </div>

      <section className="lm-panel mt-6 overflow-hidden" aria-labelledby="payments-directory-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lm-line)] px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="payments-directory-title" className="text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Transactions</h2>
              <span className="rounded-full bg-[var(--lm-teal-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--lm-teal-deep)]">{totalCount} records</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--lm-muted)]">Global transaction ledger.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">Payments directory</caption>
            <thead>
              <tr className="border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)]">
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Order ID</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Student</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Total Paid</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">LM Share</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Teacher Share</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--lm-line)]">
              {payments.map((payment) => {
                const isBooking = !!payment.booking;
                const lmShare = isBooking ? payment.booking!.commissionAmount : payment.amount;
                const teacherShare = isBooking ? payment.booking!.teacherEarnings : 0;
                
                return (
                  <tr key={payment.id} className="group transition-colors hover:bg-[var(--lm-hover)]">
                    <td className="px-6 py-4">
                      <p className="lm-mono text-[12px] text-[var(--lm-muted)]">{payment.id.split('-')[0].toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-bold text-[var(--lm-ink)]">{payment.user.email}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--lm-subtle)] capitalize">{payment.user.role.toLowerCase()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-semibold text-[var(--lm-ink-strong)]">{(payment.amount / 100).toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-medium text-[var(--lm-teal)]">{(lmShare / 100).toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[12px] font-medium text-[var(--lm-ink)]">{(teacherShare / 100).toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusStyle(payment.status)}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/payments/${payment.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--lm-line)] px-3 text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:border-[var(--lm-teal)] hover:bg-[var(--lm-teal-soft)]">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <span className="lm-empty-icon"><Inbox size={19} aria-hidden="true" /></span>
                    <p className="mt-4 text-[13px] font-bold text-[var(--lm-ink)]">No transactions found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} />
      </section>
    </div>
  );
}

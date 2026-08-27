import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const paymentData = await db.payment.findUnique({
    where: { id },
    include: {
      user: true,
      booking: {
        include: {
          teacher: true
        }
      }
    }
  });

  if (!paymentData) {
    return notFound();
  }

  // Bypass TS strict inference bugs in Next.js build
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = paymentData as any;

  const isBooking = !!payment.booking;
  const bookingTotal = isBooking ? payment.booking.amountPaid : payment.amount;
  // If GST is strictly 18%, we reverse calculate it from the total.
  // Base = Total / 1.18; GST = Total - Base
  const gst = isBooking ? Math.round(bookingTotal - (bookingTotal / 1.18)) : 0;
  const courseFee = bookingTotal - gst;
  const lmShare = isBooking ? payment.booking.commissionAmount : payment.amount;
  const teacherShare = isBooking ? payment.booking.teacherEarnings : 0;

  const getStatusStyle = (status: string) => {
    if (status === 'SUCCESS') return "lm-status lm-status--teal";
    if (status === 'FAILED') return "lm-status lm-status--red";
    return "lm-status lm-status--amber";
  };

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex items-start gap-4">
        <Link href="/payments" className="lm-icon-button mt-1 bg-[var(--lm-paper-muted)]" aria-label="Back to payments">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
            <span>Payments</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Transaction</span>
          </div>
          <h1 className="lm-page-title">Transaction <span className="lm-mono">#{payment.id.split('-')[0].toUpperCase()}</span></h1>
          <p className="lm-body-copy mt-2">Detailed view of payment authorization, fees, and revenue splits.</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="lm-panel overflow-hidden" aria-labelledby="payment-details-title">
          <div className="flex items-center justify-between border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-6 py-4">
            <h2 id="payment-details-title" className="text-[14px] font-bold text-[var(--lm-ink-strong)]">Payment Details</h2>
            <span className={getStatusStyle(payment.status)}>{payment.status}</span>
          </div>
          
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">Transaction Date</span>
              <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{payment.createdAt.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">Student Email</span>
              <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{payment.user.email}</span>
            </div>
            {isBooking && (
              <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
                <span className="text-[12px] font-medium text-[var(--lm-muted)]">Booking Type</span>
                <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{payment.booking.type || "Custom Booking"}</span>
              </div>
            )}
            {isBooking && payment.booking.teacher && (
              <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
                <span className="text-[12px] font-medium text-[var(--lm-muted)]">Assigned Teacher</span>
                <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{payment.booking.teacher.name || payment.booking.teacher.id}</span>
              </div>
            )}
            <div className="flex items-center justify-between pb-1">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">Gateway Reference</span>
              <span className="lm-mono text-[12px] font-semibold text-[var(--lm-ink)]">{payment.razorpayPaymentId || payment.razorpayOrderId || "N/A"}</span>
            </div>
          </div>
        </section>

        <section className="lm-panel overflow-hidden" aria-labelledby="financial-breakdown-title">
          <div className="flex items-center justify-between border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-6 py-4">
            <h2 id="financial-breakdown-title" className="text-[14px] font-bold text-[var(--lm-ink-strong)]">Financial Breakdown</h2>
          </div>
          
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">Course Fee (Base)</span>
              <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{(courseFee / 100).toFixed(2)} INR</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">GST (18%)</span>
              <span className="text-[13px] font-semibold text-[var(--lm-ink)]">{(gst / 100).toFixed(2)} INR</span>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-bold text-[var(--lm-ink-strong)]">Total Paid by Student</span>
              <span className="text-[14px] font-bold text-[var(--lm-ink-strong)]">{(payment.amount / 100).toFixed(2)} INR</span>
            </div>
            
            <div className="pt-2"></div>
            
            <div className="flex items-center justify-between border-b border-[var(--lm-line)] pb-4">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">LM Commission (30%)</span>
              <span className="text-[13px] font-bold text-[var(--lm-teal-deep)]">{(lmShare / 100).toFixed(2)} INR</span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-[12px] font-medium text-[var(--lm-muted)]">Teacher Share (70%)</span>
              <span className="text-[13px] font-bold text-[var(--lm-ink)]">{(teacherShare / 100).toFixed(2)} INR</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

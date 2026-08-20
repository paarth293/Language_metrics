import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function PaymentDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { id } = params;

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
  const payment = paymentData as any;

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  const isBooking = !!payment.booking;
  const courseFee = isBooking ? payment.booking.amountPaid - payment.booking.taxAmount : payment.amount;
  const gst = isBooking ? payment.booking.taxAmount : 0;
  const lmShare = isBooking ? payment.booking.commissionAmount : payment.amount;
  const teacherShare = isBooking ? payment.booking.teacherEarnings : 0;

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/payments" className="p-2 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Transaction #{payment.id.split('-')[0].toUpperCase()}</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text-muted)" }}>Payments</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>{payment.id.split('-')[0].toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Payment Details</h2>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                payment.status === 'SUCCESS' ? 'bg-green-900/30 text-green-400' :
                payment.status === 'FAILED' ? 'bg-red-900/30 text-red-400' :
                'bg-yellow-900/30 text-yellow-400'
              }`}>
                {payment.status}
              </span>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">Transaction Date</span>
                <span className="text-white">{payment.createdAt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">Student Email</span>
                <span className="text-white">{payment.user.email}</span>
              </div>
              {isBooking && (
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Booking Type</span>
                  <span className="text-white">{payment.booking.type || "Custom Booking"}</span>
                </div>
              )}
              {isBooking && payment.booking.teacher && (
                <div className="flex justify-between border-b border-gray-700 pb-2">
                  <span className="text-gray-400">Assigned Teacher</span>
                  <span className="text-white">{payment.booking.teacher.name || payment.booking.teacher.id}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">Gateway Reference</span>
                <span className="text-white font-mono text-xs">{payment.razorpayPaymentId || payment.razorpayOrderId || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div style={cardStyle} className="rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Financial Breakdown</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">Course Fee (Base)</span>
                <span className="text-white font-medium">{(courseFee / 100).toFixed(2)} INR</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">GST (18%)</span>
                <span className="text-white font-medium">{(gst / 100).toFixed(2)} INR</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-300 font-semibold">Total Paid by Student</span>
                <span className="text-white font-bold">{(payment.amount / 100).toFixed(2)} INR</span>
              </div>
              
              <div className="pt-2"></div>
              
              <div className="flex justify-between border-b border-gray-700 pb-2">
                <span className="text-gray-400">LM Commission (30%)</span>
                <span className="text-indigo-400 font-medium">{(lmShare / 100).toFixed(2)} INR</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-gray-400">Teacher Share (70%)</span>
                <span className="text-green-400 font-medium">{(teacherShare / 100).toFixed(2)} INR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

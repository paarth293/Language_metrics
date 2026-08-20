import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

function inr(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function InvoicesPage() {
  await requireAdmin();
  const invoices = await db.invoice.findMany({ orderBy: { createdAt: "desc" } });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };
  const statusColors: Record<string, string> = {
    DRAFT: "var(--lm-text-subtle)",
    ISSUED: "var(--lm-accent)",
    PAID: "var(--lm-ok)",
    CANCELLED: "var(--lm-err)",
    CREDIT_NOTE: "#22d3ee",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">GST & Invoices</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Generate and download GST-compliant invoices.</p>
        </div>
        <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-4 py-2 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity">
          Generate Invoice
        </button>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Invoice #", "Order", "Billing", "Gross", "Tax", "Total", "Status", "Action"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-accent)" }} className="py-3.5 px-5 text-[13px] font-bold">{inv.invoiceNumber}</td>
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px]">{inv.orderId.slice(0, 10).toUpperCase()}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{inv.billingType}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{inr(inv.grossAmount)}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{inr(inv.taxAmount)}</td>
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px] font-medium">{inr(inv.totalAmount)}</td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: statusColors[inv.status] ?? "var(--lm-text-muted)" }} className="px-2 py-0.5 rounded text-[11px] font-medium">{inv.status}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <button style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }} className="px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">PDF</button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No invoices yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

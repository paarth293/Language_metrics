import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Coupons & Offers</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Create and manage promotional discounts.</p>
        </div>
        <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-4 py-2 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity">
          Create Coupon
        </button>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Code", "Type", "Value", "Scope", "Used", "Max", "Expires", "Status", "Action"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-accent)" }} className="py-3.5 px-5 text-[13px] font-bold">{c.code}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.discountType}</td>
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px]">{c.discountType === "PERCENTAGE" ? c.discountValue + "%" : "₹" + (c.discountValue / 100)}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.scope}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.usedCount}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.maxUses ?? "∞"}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{c.expiresAt?.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) ?? "—"}</td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: c.isActive ? "var(--lm-ok)" : "var(--lm-err)" }} className="px-2 py-0.5 rounded text-[11px] font-medium">{c.isActive ? "Active" : "Disabled"}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <button style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }} className="px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">Edit</button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr><td colSpan={9} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No coupons yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

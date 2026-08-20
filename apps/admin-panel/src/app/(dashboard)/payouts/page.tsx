import { CreditCard, Search, Filter } from "lucide-react";

export default function PayoutsPage() {
  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Payouts</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Manage teacher compensation and platform revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-4 py-2 rounded-md text-[13px] font-bold hover:opacity-90 transition-opacity">
            Process Batch
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ background: "var(--lm-surface)", border: "1px solid var(--lm-border)" }} className="rounded-xl overflow-hidden p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div style={{ background: "var(--lm-surface2)" }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <CreditCard size={24} style={{ color: "var(--lm-text-muted)" }} />
        </div>
        <h3 style={{ color: "var(--lm-text)" }} className="text-lg font-bold mb-1">No Pending Payouts</h3>
        <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] max-w-sm">All teacher compensations are up to date. Future payout cycles will appear here for processing.</p>
      </div>
    </div>
  );
}

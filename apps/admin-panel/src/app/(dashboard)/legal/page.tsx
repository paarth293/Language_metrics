import { requireAdmin } from "@/lib/guards";

export default async function LegalPage() {
  await requireAdmin();

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };
  const docs = [
    "Teacher Agreements",
    "Student Terms",
    "Privacy Policy",
    "Refund Policy",
    "Teacher Code of Conduct",
    "Platform Rules",
    "BGV Records",
    "Consent Records",
    "Recording Consent",
    "Invoice Records",
    "GST Records",
  ];

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Legal & Compliance</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Policy documents, BGV records, and compliance artefacts.</p>
        </div>
      </div>

      <div style={cardStyle} className="rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <button key={d} style={{ border: "1px solid var(--lm-border2)", background: "var(--lm-bg)" }} className="flex items-center justify-between px-4 py-3 rounded-lg text-[13px] font-medium hover:border-yellow-500/50 transition-colors text-left">
              <span style={{ color: "var(--lm-text)" }}>{d}</span>
              <span style={{ color: "var(--lm-accent)" }} className="text-[11px] font-bold uppercase">Manage</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

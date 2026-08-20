import { BookOpen, Search, Filter } from "lucide-react";

export default function ClassesPage() {
  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Classes</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Monitor active and scheduled learning sessions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--lm-text-subtle)" }} />
            <input
              type="text"
              placeholder="Search classes..."
              style={{
                background: "var(--lm-surface)",
                border: "1px solid var(--lm-border)",
                color: "var(--lm-text)",
              }}
              className="w-[250px] rounded-md py-2 pl-9 pr-3 text-[13px] font-medium outline-none focus:border-yellow-500/50 transition-colors"
            />
          </div>
          <button style={{ border: "1px solid var(--lm-border)", color: "var(--lm-text)" }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold bg-[var(--lm-surface)] hover:bg-[var(--lm-surface2)] transition-colors">
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ background: "var(--lm-surface)", border: "1px solid var(--lm-border)" }} className="rounded-xl overflow-hidden p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div style={{ background: "var(--lm-surface2)" }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={24} style={{ color: "var(--lm-text-muted)" }} />
        </div>
        <h3 style={{ color: "var(--lm-text)" }} className="text-lg font-bold mb-1">No Active Classes</h3>
        <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] max-w-sm">There are no classes scheduled or running at the moment. As tutors create sessions, they will appear here.</p>
      </div>
    </div>
  );
}

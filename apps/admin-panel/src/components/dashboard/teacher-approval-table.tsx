import Link from "next/link";
import { ArrowUpRight, Inbox, Search, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import type { TeacherApprovalRow, ApprovalStatus } from "./types";

function statusLabel(status: ApprovalStatus): string {
  if (status === "INTERVIEW_SCHEDULED") return "Interview scheduled";
  if (status === "REJECTED") return "Needs info";
  if (status === "APPROVED") return "Approved";
  return "Pending approval";
}

function statusClass(status: ApprovalStatus): string {
  if (status === "APPROVED") return "lm-status lm-status--teal";
  if (status === "REJECTED") return "lm-status lm-status--red";
  if (status === "INTERVIEW_SCHEDULED") return "lm-status lm-status--blue";
  return "lm-status lm-status--amber";
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "NA";
}

export function TeacherApprovalTable({ rows, pendingCount }: { rows: TeacherApprovalRow[]; pendingCount: number }) {
  return (
    <section className="lm-panel overflow-hidden" aria-labelledby="teacher-approvals-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lm-line)] px-6 py-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 id="teacher-approvals-title" className="text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Teacher approvals</h2>
            <span className="rounded-full bg-[var(--lm-amber-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--lm-amber)]">{pendingCount} pending</span>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--lm-muted)]">Review new applications and keep the teaching network healthy.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative hidden items-center sm:flex">
            <Search size={14} className="pointer-events-none absolute left-3 text-[var(--lm-subtle)]" aria-hidden="true" />
            <input aria-label="Search teachers" placeholder="Search teachers" className="lm-input h-9 w-[150px] pl-9 pr-3 text-[11px]" />
          </label>
          <button type="button" aria-label="Open teacher filters" className="lm-icon-button h-9 min-h-9 w-9 min-w-9 border border-[var(--lm-line)]">
            <SlidersHorizontal size={15} aria-hidden="true" />
          </button>
          <Link href="/teachers" className="lm-button-secondary min-h-9 px-3 text-[11px]">View all</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <caption className="sr-only">Teacher approvals preview</caption>
          <thead>
            <tr className="border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)]">
              {[
                ["Teacher", "left"],
                ["Applied on", "left"],
                ["Language", "left"],
                ["Status", "left"],
                ["Action", "right"],
              ].map(([label, align]) => (
                <th key={label} scope="col" className={clsx("px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]", align === "right" && "text-right")}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--lm-line)]">
            {rows.map((row) => (
              <tr key={row.userId} className="group transition-colors hover:bg-[var(--lm-hover)]">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] text-[11px] font-bold text-[var(--lm-teal-deep)]">{initials(row.name)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-[var(--lm-ink)]">{row.name}</p>
                      {row.email ? <p className="mt-0.5 truncate text-[10px] text-[var(--lm-subtle)]">{row.email}</p> : null}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-[11px] text-[var(--lm-muted)]">{row.createdAt}</td>
                <td className="px-6 py-4 text-[11px] text-[var(--lm-muted)]">{row.language || "Not specified"}</td>
                <td className="px-6 py-4"><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></td>
                <td className="px-6 py-4 text-right"><Link href={row.href} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:bg-[var(--lm-teal-soft)]">{row.status === "PENDING" || row.status === "REJECTED" ? "Review" : "Profile"}<ArrowUpRight size={13} aria-hidden="true" /></Link></td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <span className="lm-empty-icon"><Inbox size={18} aria-hidden="true" /></span>
                  <p className="mt-3 text-[12px] font-semibold text-[var(--lm-ink)]">No approvals in this window</p>
                  <p className="mt-1 text-[11px] text-[var(--lm-subtle)]">New applications will appear automatically.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-6 py-3.5 text-[10px] text-[var(--lm-subtle)]">
        <span className="flex items-center gap-2"><Inbox size={14} aria-hidden="true" /> {rows.length ? "Showing the latest applications in the review queue." : "New applications will appear automatically."}</span>
        <Link href="/teachers?filter=pending" className="font-semibold text-[var(--lm-teal-deep)]">Open approval queue <ArrowUpRight size={12} className="inline" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

export { statusLabel, statusClass };

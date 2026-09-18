import { Clock, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import type { VerificationStatus } from "@/types";

const CONFIG: Record<
  VerificationStatus,
  { label: string; icon: typeof Clock; className: string; dot: string }
> = {
  PENDING: {
    label: "Pending review",
    icon: Clock,
    className: "bg-gold/12 text-gold-dark border-gold/30",
    dot: "bg-gold",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview scheduled",
    icon: CalendarClock,
    className: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-red-500",
  },
};

export default function StatusBadge({
  status,
  showIcon = true,
  className = "",
}: {
  status: VerificationStatus;
  showIcon?: boolean;
  className?: string;
}) {
  const cfg = CONFIG[status] ?? CONFIG.PENDING;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${cfg.className} ${className}`}
    >
      {showIcon ? (
        <Icon className="w-3.5 h-3.5" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      )}
      {cfg.label}
    </span>
  );
}
export type { VerificationStatus };

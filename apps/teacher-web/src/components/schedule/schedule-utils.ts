import { getJoinState } from "@/lib/class-join";

export type AvailabilitySlot = {
  dayOfWeek: number; // 0 = Sunday, matching Date#getDay and the API
  startTime: string; // "HH:mm"
  endTime: string;
};

export type ScheduleSession = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  joinOpensAt?: string;
  joinClosesAt?: string;
  booking: { id: string; status: string; type: string };
  student: { userId: string; name: string; avatarUrl: string | null; proficiencyLevel: string };
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Weeks are displayed Monday-first; values are Date#getDay indexes. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ── Dates ────────────────────────────────────────────────────────────────

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// ── Formatting ───────────────────────────────────────────────────────────

const MONTH = (d: Date) => d.toLocaleString("en-US", { month: "short" });

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return formatTime(new Date(2000, 0, 1, h, m || 0));
}

export function formatHourLabel(hour: number): string {
  return new Date(2000, 0, 1, hour % 24).toLocaleTimeString([], { hour: "numeric" });
}

export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  if (weekStart.getFullYear() !== end.getFullYear()) {
    return `${weekStart.getDate()} ${MONTH(weekStart)} ${weekStart.getFullYear()} – ${end.getDate()} ${MONTH(end)} ${end.getFullYear()}`;
  }
  const startLabel = weekStart.getMonth() === end.getMonth() ? `${weekStart.getDate()}` : `${weekStart.getDate()} ${MONTH(weekStart)}`;
  return `${startLabel} – ${end.getDate()} ${MONTH(end)} ${end.getFullYear()}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function sessionMinutes(s: ScheduleSession): number {
  return Math.max(0, Math.round((Date.parse(s.scheduledEnd) - Date.parse(s.scheduledStart)) / 60_000));
}

/** "in 12 min", "Today, 4:00 PM", "Tomorrow, 9:00 AM", "Thu, 9:00 AM". */
export function formatRelativeStart(start: Date, now: number): string {
  const diffMin = Math.round((start.getTime() - now) / 60_000);
  if (diffMin > 0 && diffMin < 60) return `in ${diffMin} min`;
  const today = new Date(now);
  if (isSameDay(start, today)) return `Today, ${formatTime(start)}`;
  if (isSameDay(start, addDays(today, 1))) return `Tomorrow, ${formatTime(start)}`;
  return `${DAY_SHORT[start.getDay()]} ${start.getDate()} ${MONTH(start)}, ${formatTime(start)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// ── Session state ────────────────────────────────────────────────────────

export type SessionTone = "live" | "open" | "soon" | "upcoming" | "pending" | "completed" | "ended" | "cancelled";

export function getSessionTone(s: ScheduleSession, now: number): SessionTone {
  if (s.status === "CANCELLED" || s.booking.status === "CANCELLED") return "cancelled";
  if (s.status === "COMPLETED") return "completed";
  const join = getJoinState(s, now);
  if (join === "closed") return "ended";
  if (join === "upcoming" && s.booking.status === "PENDING") return "pending";
  return join;
}

export const TONE_LABEL: Record<SessionTone, string> = {
  live: "Live now",
  open: "Join now",
  soon: "Starting soon",
  upcoming: "Scheduled",
  pending: "Pending",
  completed: "Completed",
  ended: "Ended",
  cancelled: "Cancelled",
};

/** Class names per tone: calendar block, accent bar, and status pill. */
export const TONE_STYLES: Record<SessionTone, { block: string; bar: string; pill: string }> = {
  live: {
    block: "bg-trust/15 border-trust/50 hover:bg-trust/20",
    bar: "bg-trust",
    pill: "bg-trust/15 text-trust",
  },
  open: {
    block: "bg-action/20 border-action/60 hover:bg-action/25",
    bar: "bg-action",
    pill: "bg-action/20 text-gold-strong",
  },
  soon: {
    block: "bg-action/10 border-action/40 hover:bg-action/15",
    bar: "bg-action",
    pill: "bg-action/15 text-gold-strong",
  },
  upcoming: {
    block: "bg-brand/10 border-brand/25 hover:bg-brand/15",
    bar: "bg-brand",
    pill: "bg-brand/10 text-brand",
  },
  pending: {
    block: "bg-surface border-dashed border-brand/40 hover:bg-brand/5",
    bar: "bg-brand/40",
    pill: "bg-surface-inset text-text-muted",
  },
  completed: {
    block: "bg-surface-inset border-border hover:border-border-strong",
    bar: "bg-text-subtle/50",
    pill: "bg-surface-inset text-text-muted",
  },
  ended: {
    block: "bg-surface-inset border-border hover:border-border-strong",
    bar: "bg-text-subtle/50",
    pill: "bg-surface-inset text-text-subtle",
  },
  cancelled: {
    block: "bg-alert/5 border-alert/25 hover:bg-alert/10",
    bar: "bg-alert/60",
    pill: "bg-alert/10 text-alert",
  },
};

export function isActiveTone(tone: SessionTone): boolean {
  return tone !== "cancelled";
}

// ── Calendar layout ──────────────────────────────────────────────────────

export type PositionedSession = { session: ScheduleSession; lane: number; lanes: number };

/** Places overlapping sessions side by side: each overlap cluster shares its lane count. */
export function layoutDay(sessions: ScheduleSession[]): PositionedSession[] {
  const sorted = [...sessions].sort(
    (a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart) || Date.parse(a.scheduledEnd) - Date.parse(b.scheduledEnd)
  );
  const result: PositionedSession[] = [];
  let cluster: PositionedSession[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };

  for (const s of sorted) {
    const start = Date.parse(s.scheduledStart);
    const end = Math.max(Date.parse(s.scheduledEnd), start + 15 * 60_000);
    if (start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    const p = { session: s, lane, lanes: 1 };
    cluster.push(p);
    result.push(p);
    clusterEnd = Math.max(clusterEnd, end);
  }
  closeCluster();
  return result;
}

/** Visible hour window: everything booked or available this week, with a little breathing room. */
export function getHourRange(sessions: ScheduleSession[], availability: AvailabilitySlot[]): [number, number] {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const s of sessions) {
    const start = new Date(s.scheduledStart);
    const end = new Date(s.scheduledEnd);
    starts.push(minutesOfDay(start));
    ends.push(isSameDay(start, end) ? minutesOfDay(end) : 24 * 60);
  }
  for (const a of availability) {
    starts.push(timeToMinutes(a.startTime));
    ends.push(timeToMinutes(a.endTime));
  }
  if (starts.length === 0) return [8, 20];

  let from = Math.max(0, Math.floor(Math.min(...starts) / 60) - 1);
  let to = Math.min(24, Math.ceil(Math.max(...ends) / 60) + 1);
  while (to - from < 10) {
    if (to < 24) to++;
    else if (from > 0) from--;
    else break;
  }
  return [from, to];
}

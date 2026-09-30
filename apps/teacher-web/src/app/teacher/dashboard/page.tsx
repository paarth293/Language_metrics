"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Inbox,
  Settings2,
  Star,
  UserRoundPen,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SessionRow } from "@/components/schedule/SessionRow";
import { useNow } from "@/lib/class-join";
import {
  type ScheduleSession,
  DAY_SHORT,

  addDays,
  formatRelativeStart,
  formatTime,
  getSessionTone,
  initials,
  isSameDay,
  startOfWeek,
} from "@/components/schedule/schedule-utils";

type DashboardData = {
  profile: { name: string; status: string; hasAvatar: boolean; hasBio: boolean };
  stats: {
    activeStudents: number;
    pendingBookings: number;
    classesTaught: number;
    averageRating: number;
    totalReviews: number;
    monthEarnings: number;
    availabilitySlots: number;
  };
  weekSessions: ScheduleSession[];
  nextSession: ScheduleSession | null;
  recentBookings: Array<{
    id: string;
    status: string;
    type: string;
    amount: number;
    createdAt: string;
    name: string;
    avatarUrl: string | null;
  }>;
};

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

/** "In 12 min", "Today", "Tomorrow", "Thu 1 Oct" — the clock time is shown separately. */
function startsIn(start: Date, now: number) {
  const mins = Math.round((start.getTime() - now) / 60_000);
  if (mins > 0 && mins < 60) return `In ${mins} min`;
  if (isSameDay(start, new Date(now))) return "Today";
  if (isSameDay(start, addDays(new Date(now), 1))) return "Tomorrow";
  return start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Panel({
  kicker,
  title,
  action,
  children,
  className,
}: {
  kicker: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-surface p-5 shadow-level-1", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-subtle">{kicker}</p>
          {title && <h2 className="mt-1.5 text-[15px] font-bold tracking-[-0.015em] text-text">{title}</h2>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const panelLink = "inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand hover:underline";

export default function TeacherDashboard() {
  const now = useNow();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const weekStart = startOfWeek(new Date());
    const today = new Date();
    const params = new URLSearchParams({
      weekStart: weekStart.toISOString(),
      weekEnd: addDays(weekStart, 7).toISOString(),
      monthStart: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
      monthEnd: new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString(),
    });
    try {
      const res = await fetch(`/api/teachers/dashboard?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(false);
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setError(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Keeps "Up next" and Join buttons current as classes start.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const todayDate = new Date(now);

  const derived = useMemo(() => {
    if (!data) return null;
    const active = data.weekSessions.filter((s) => getSessionTone(s, now) !== "cancelled");
    const weekStart = startOfWeek(new Date(now));
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return { date, count: active.filter((s) => isSameDay(new Date(s.scheduledStart), date)).length };
    });
    const today = active.filter((s) => isSameDay(new Date(s.scheduledStart), new Date(now)));
    return { active, days, today, max: Math.max(1, ...days.map((d) => d.count)) };
  }, [data, now]);

  if (error && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-level-1">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-alert" />
          <h2 className="text-[15px] font-bold text-text">We couldn&apos;t load your dashboard</h2>
          <p className="mb-5 mt-1 text-[13px] text-text-muted">Check your connection and try again.</p>
          <Button variant="primary" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !derived) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-16 w-72 animate-pulse rounded-lg bg-surface-inset" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[112px] animate-pulse rounded-xl bg-surface-inset" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)]">
          <div className="h-72 animate-pulse rounded-xl bg-surface-inset" />
          <div className="h-72 animate-pulse rounded-xl bg-surface-inset" />
        </div>
      </div>
    );
  }

  const { stats, profile, nextSession, recentBookings } = data;
  const firstName = profile.name.split(/\s+/)[0] || "there";
  const nextTone = nextSession ? getSessionTone(nextSession, now) : null;
  const nextJoinable = nextTone === "live" || nextTone === "open";
  const nextStarted = !!nextSession && now >= Date.parse(nextSession.scheduledStart);

  const attention = [
    stats.pendingBookings > 0 && {
      icon: Inbox,
      label: "Pending bookings",
      detail: `${stats.pendingBookings} booking${stats.pendingBookings === 1 ? "" : "s"} waiting for you`,
      value: String(stats.pendingBookings).padStart(2, "0"),
      href: "/teacher/sessions",
      tone: "bg-action/15 text-gold-strong",
    },
    stats.availabilitySlots === 0 && {
      icon: Settings2,
      label: "Set working hours",
      detail: "Students can't see when to book you",
      value: "Now",
      href: "/teacher/schedule",
      tone: "bg-alert/10 text-alert",
    },
    (!profile.hasBio || !profile.hasAvatar) && {
      icon: UserRoundPen,
      label: "Complete your profile",
      detail: [!profile.hasAvatar && "photo", !profile.hasBio && "bio"].filter(Boolean).join(" and ") + " missing",
      value: "Edit",
      href: "/teacher/profile",
      tone: "bg-brand/10 text-brand",
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; label: string; detail: string; value: string; href: string; tone: string }>;

  return (
    <div className="space-y-4 pb-10">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="lm-page-title">
            {greeting(todayDate.getHours())}, {firstName}
          </h1>
          <p className="mt-1.5 text-[11px] text-text-subtle">
            {todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            <span className="mx-1.5">·</span>
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/teacher/schedule">
              <CalendarDays className="h-4 w-4" /> Open schedule
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/teacher/sessions">
              <Inbox className="h-4 w-4" /> Sessions
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Up next ────────────────────────────────────── */}
      {nextSession && nextTone && (
        <section
          aria-label="Next class"
          className="relative flex flex-col gap-4 overflow-hidden rounded-xl bg-navy px-5 py-4 text-cream shadow-level-2 dark:border dark:border-gold/20 sm:flex-row sm:items-center"
        >
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl" aria-hidden />
          <div className="relative flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream/10 text-[12px] font-bold text-gold">
              {initials(nextSession.student.name)}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">
                {nextTone === "live" ? "In progress" : nextStarted ? "Happening now" : "Up next"}
              </p>
              <p className="mt-0.5 truncate text-[15px] font-bold">
                {nextSession.student.name}
                <span className="ml-2 rounded bg-cream/10 px-1.5 py-px text-[10px] font-bold text-cream/80">
                  {nextSession.student.proficiencyLevel}
                </span>
              </p>
              <p className="mt-0.5 text-[12px] text-cream/65">
                {nextStarted
                  ? `Started ${formatTime(new Date(nextSession.scheduledStart))} · until ${formatTime(new Date(nextSession.scheduledEnd))}`
                  : `${startsIn(new Date(nextSession.scheduledStart), now)} · ${formatTime(new Date(nextSession.scheduledStart))} – ${formatTime(new Date(nextSession.scheduledEnd))}`}
              </p>
            </div>
          </div>
          <div className="relative shrink-0">
            {nextJoinable ? (
              <Button asChild variant="gold">
                <Link href={`/live/${nextSession.id}`}>
                  <Video className="h-4 w-4" /> {nextTone === "live" ? "Rejoin class" : "Join class"}
                </Link>
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-cream/15 px-3 py-2 text-[12px] text-cream/75">
                <Clock className="h-3.5 w-3.5" />
                Join opens {formatTime(new Date(nextSession.joinOpensAt ?? nextSession.scheduledStart))}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Metrics ────────────────────────────────────── */}
      <section aria-label="This week at a glance" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          highlight
          icon={CalendarDays}
          label="Classes this week"
          value={derived.active.length}
          helper={`${derived.today.length} today`}
        />
        <MetricCard
          icon={Users}
          label="Active students"
          value={stats.activeStudents}
          helper={`${stats.classesTaught} class${stats.classesTaught === 1 ? "" : "es"} taught`}
          accentColor="var(--color-trust)"
          accentBg="var(--color-trust-subtle)"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Earned this month"
          value={rupees(stats.monthEarnings)}
          helper="From completed bookings"
        />
        <MetricCard
          icon={Star}
          label="Rating"
          value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
          helper={stats.totalReviews ? `${stats.totalReviews} review${stats.totalReviews === 1 ? "" : "s"}` : "No reviews yet"}
          accentColor="var(--color-brand)"
          accentBg="var(--color-brand-subtle)"
        />
      </section>

      {/* ── Week + today ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)]">
        <Panel
          kicker="This week"
          title={`${derived.active.length} class${derived.active.length === 1 ? "" : "es"} booked`}
          action={
            <Link href="/teacher/schedule" className={panelLink}>
              Schedule <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="flex flex-1 items-end gap-2 pt-2" role="img" aria-label={derived.days.map((d) => `${DAY_SHORT[d.date.getDay()]} ${d.count}`).join(", ")}>
            {derived.days.map(({ date, count }) => {
              const isToday = isSameDay(date, todayDate);
              const height = count > 0 ? Math.max(Math.round((count / derived.max) * 120), 14) : 4;
              return (
                <div key={date.toISOString()} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-[150px] w-full flex-col items-center justify-end">
                    <span
                      className={cn(
                        "mb-1.5 font-mono text-[11px] font-semibold tabular-nums",
                        count === 0 ? "invisible" : isToday ? "text-brand" : "text-text-muted"
                      )}
                    >
                      {count}
                    </span>
                    <div
                      className={cn(
                        "w-full max-w-[38px] rounded-md transition-all duration-300",
                        isToday ? "bg-brand" : count > 0 ? "bg-brand/25" : "bg-surface-inset"
                      )}
                      style={{ height }}
                    />
                  </div>
                  <span className={cn("text-[11px]", isToday ? "font-bold text-brand" : "font-medium text-text-subtle")}>
                    {isToday ? "Today" : DAY_SHORT[date.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          kicker="Today"
          title={todayDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
          action={
            <span className="rounded-full bg-surface-inset px-2 py-1 text-[10px] font-semibold text-text-muted">
              {derived.today.length} class{derived.today.length === 1 ? "" : "es"}
            </span>
          }
        >
          {derived.today.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
              <CalendarCheck2 className="h-5 w-5 text-text-subtle" />
              <p className="text-[13px] font-semibold text-text">No classes today</p>
              <p className="text-[12px] text-text-muted">
                {nextSession ? `Next: ${formatRelativeStart(new Date(nextSession.scheduledStart), now)}` : "Nothing booked yet."}
              </p>
            </div>
          ) : (
            <div className="-mx-1 max-h-[260px] space-y-2 overflow-y-auto px-1">
              {derived.today.map((s) => (
                <SessionRow key={s.id} session={s} now={now} compact />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Activity + attention ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.85fr)]">
        <Panel
          kicker="Recent bookings"
          title="Latest activity"
          action={
            <Link href="/teacher/sessions" className={panelLink}>
              All sessions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {recentBookings.length === 0 ? (
            <p className="rounded-lg bg-surface-inset/60 px-4 py-6 text-center text-[13px] text-text-muted">
              New bookings will show up here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentBookings.map((b) => {
                const tone =
                  b.status === "CONFIRMED" ? "bg-trust/10 text-trust" : b.status === "PENDING" ? "bg-action/15 text-gold-strong" : b.status === "CANCELLED" ? "bg-alert/10 text-alert" : "bg-surface-inset text-text-muted";
                return (
                  <li key={b.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                      {initials(b.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-text">{b.name}</p>
                      <p className="text-[11px] text-text-subtle">
                        <span className="capitalize">{b.type.toLowerCase()}</span> booking ·{" "}
                        {new Date(b.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="hidden font-mono text-[12px] font-semibold text-text sm:inline">{rupees(b.amount)}</span>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold", tone)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" aria-hidden />
                      {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel kicker="Needs attention" title={attention.length ? `${attention.length} thing${attention.length === 1 ? "" : "s"} to do` : "You're all set"}>
          {attention.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-trust/5 px-4 py-6 text-center">
              <CheckCircle2 className="h-5 w-5 text-trust" />
              <p className="text-[12px] text-text-muted">No pending bookings, and your profile and hours are set.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {attention.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-inset"
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", item.tone)}>
                      <item.icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-text">{item.label}</span>
                      <span className="block truncate text-[11px] text-text-subtle">{item.detail}</span>
                    </span>
                    <span className={cn("text-[12px] font-semibold text-text-muted", /^\d+$/.test(item.value) && "font-mono")}>
                      {item.value}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

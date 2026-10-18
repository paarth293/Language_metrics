"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  Clock,
  GraduationCap,
  Search,
  Timer,
  UserRoundPen,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { canJoin, getJoinState, useNow } from "@/lib/class-join";

type UpcomingClass = {
  id: string;
  sessionId?: string;
  teacher: string;
  avatar: string | null;
  language: string;
  type: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  sessionStatus?: string;
  joinOpensAt?: string;
  joinClosesAt?: string;
};

type DashboardData = {
  profile: { name: string; languageToLearn: string; proficiencyLevel: string; avatarUrl: string | null };
  stats: {
    totalClasses: number;
    totalHours: number;
    uniqueTeachers: number;
    coinBalance: number;
    monthlyClasses: number;
  };
  upcomingClasses: UpcomingClass[];
  recentActivity: Array<{
    id: string;
    teacher: string;
    avatar: string | null;
    type: string;
    language: string;
    date: string;
    amount: number;
  }>;
};

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "In 12 min", "Today", "Tomorrow", "Thu 1 Oct" — the clock time is shown separately. */
function startsIn(start: Date, now: number) {
  const mins = Math.round((start.getTime() - now) / 60_000);
  if (mins > 0 && mins < 60) return `In ${mins} min`;
  if (sameDay(start, new Date(now))) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(start, tomorrow)) return "Tomorrow";
  return start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function joinStateOf(c: UpcomingClass, now: number) {
  if (!c.scheduledStart || !c.scheduledEnd) return "upcoming" as const;
  return getJoinState(
    {
      status: c.sessionStatus ?? "SCHEDULED",
      scheduledStart: c.scheduledStart,
      scheduledEnd: c.scheduledEnd,
      joinOpensAt: c.joinOpensAt,
      joinClosesAt: c.joinClosesAt,
    },
    now
  );
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

function Metric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "bg-surface-inset text-text-muted",
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: React.ElementType;
  tone?: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex min-h-[112px] flex-col justify-between rounded-xl border p-5 shadow-level-1",
        highlight ? "border-gold/30 bg-navy text-cream dark:border-gold/20" : "border-border bg-surface"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[10px] font-bold uppercase leading-tight tracking-[0.16em]", highlight ? "text-gold-soft" : "text-text-subtle")}>
          {label}
        </p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", highlight ? "bg-cream/10 text-gold" : tone)}>
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 min-w-0">
        <p className={cn("font-mono text-[24px] font-semibold leading-none tracking-[-0.04em]", highlight ? "text-cream" : "text-text")}>
          {value}
        </p>
        <p className={cn("mt-1.5 truncate text-[10px]", highlight ? "text-cream/55" : "text-text-subtle")}>{helper}</p>
      </div>
    </article>
  );
}

const panelLink = "inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-brand hover:underline";

export default function StudentDashboard() {
  const now = useNow();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/students/dashboard", { credentials: "include" });
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

  if (!data) {
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

  const { profile, stats, upcomingClasses, recentActivity } = data;
  const today = new Date(now);
  const firstName = profile.name.split(/\s+/)[0] || "there";
  const next = upcomingClasses[0];
  const nextState = next ? joinStateOf(next, now) : null;
  const nextStart = next?.scheduledStart ? new Date(next.scheduledStart) : null;
  const nextEnd = next?.scheduledEnd ? new Date(next.scheduledEnd) : null;
  const nextStarted = !!nextStart && now >= nextStart.getTime();

  return (
    <div className="space-y-4 pb-10">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="lm-page-title">
            {greeting(today.getHours())}, {firstName}
          </h1>
          <p className="mt-1.5 text-[11px] text-text-subtle">
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            {profile.languageToLearn && (
              <>
                <span className="mx-1.5">·</span>Learning {profile.languageToLearn}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/classes">
              <CalendarDays className="h-4 w-4" /> My classes
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/discover">
              <Search className="h-4 w-4" /> Find a teacher
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Up next ────────────────────────────────────── */}
      {next && nextState && nextStart && nextEnd && (
        <section
          aria-label="Next class"
          className="relative flex flex-col gap-4 overflow-hidden rounded-xl bg-navy px-5 py-4 text-cream shadow-level-2 dark:border dark:border-gold/20 sm:flex-row sm:items-center"
        >
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl" aria-hidden />
          <div className="relative flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream/10 text-[12px] font-bold text-gold">
              {initials(next.teacher)}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">
                {nextState === "live" ? "In progress" : nextStarted ? "Happening now" : "Up next"}
              </p>
              <p className="mt-0.5 truncate text-[15px] font-bold">
                {next.teacher}
                <span className="ml-2 rounded bg-cream/10 px-1.5 py-px text-[10px] font-bold text-cream/80">{next.language}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-cream/65">
                {nextStarted
                  ? `Started ${time(nextStart)} · until ${time(nextEnd)}`
                  : `${startsIn(nextStart, now)} · ${time(nextStart)} – ${time(nextEnd)}`}
              </p>
            </div>
          </div>
          <div className="relative shrink-0">
            {canJoin(nextState) ? (
              <Button asChild variant="gold">
                <Link href={`/live/${next.sessionId || next.id}`}>
                  <Video className="h-4 w-4" /> {nextState === "live" ? "Rejoin class" : "Join class"}
                </Link>
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-cream/15 px-3 py-2 text-[12px] text-cream/75">
                <Clock className="h-3.5 w-3.5" />
                Join opens {time(new Date(next.joinOpensAt ?? next.scheduledStart!))}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Metrics ────────────────────────────────────── */}
      <section aria-label="Your learning at a glance" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric
          highlight
          icon={Wallet}
          label="Coin balance"
          value={stats.coinBalance.toLocaleString("en-IN")}
          helper="1 coin = ₹1"
        />
        <Metric
          icon={BookOpen}
          label="Classes completed"
          value={stats.totalClasses}
          helper={stats.monthlyClasses ? `${stats.monthlyClasses} this month` : "None this month yet"}
          tone="bg-trust/10 text-trust"
        />
        <Metric
          icon={Timer}
          label="Hours learned"
          value={stats.totalHours % 1 ? stats.totalHours.toFixed(1) : stats.totalHours}
          helper="Time in completed classes"
          tone="bg-action/15 text-gold-strong"
        />
        <Metric
          icon={Users}
          label="Teachers"
          value={stats.uniqueTeachers}
          helper={stats.uniqueTeachers === 1 ? "You've learned with 1 teacher" : `You've learned with ${stats.uniqueTeachers}`}
          tone="bg-brand/10 text-brand"
        />
      </section>

      {/* ── Upcoming + learning ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)]">
        <Panel
          kicker="Upcoming classes"
          title={`${upcomingClasses.length} scheduled`}
          action={
            <Link href="/classes" className={panelLink}>
              All classes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {upcomingClasses.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
              <CalendarCheck2 className="h-5 w-5 text-text-subtle" />
              <p className="text-[13px] font-semibold text-text">No upcoming classes</p>
              <p className="text-[12px] text-text-muted">Book a class to keep your {profile.languageToLearn || "learning"} going.</p>
              <Button asChild variant="primary" size="sm" className="mt-2">
                <Link href="/discover">Find a teacher</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingClasses.map((c) => {
                const start = c.scheduledStart ? new Date(c.scheduledStart) : null;
                const end = c.scheduledEnd ? new Date(c.scheduledEnd) : null;
                const state = joinStateOf(c, now);
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-[64px] shrink-0 text-right tabular-nums">
                      <p className="text-[13px] font-bold text-text">{start ? time(start) : "TBD"}</p>
                      <p className="text-[11px] text-text-subtle">{start ? startsIn(start, now) : ""}</p>
                    </div>
                    <span className={cn("w-1 self-stretch rounded-full", canJoin(state) ? "bg-action" : "bg-brand/40")} aria-hidden />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                      {initials(c.teacher)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-text">{c.teacher}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-text-subtle">
                        <span className="rounded bg-surface-inset px-1.5 py-px text-[10px] font-bold text-text-secondary">{c.language}</span>
                        {c.type === "DEMO" ? "Demo class" : "Class"}
                        {start && end && (
                          <span className="hidden sm:inline">
                            · {time(start)} – {time(end)}
                          </span>
                        )}
                      </p>
                    </div>
                    {canJoin(state) ? (
                      <Button asChild variant="primary" size="sm">
                        <Link href={`/live/${c.sessionId || c.id}`}>
                          <Video className="h-3.5 w-3.5" /> {state === "live" ? "Rejoin" : "Join"}
                        </Link>
                      </Button>
                    ) : (
                      <span className="hidden shrink-0 rounded-full bg-surface-inset px-2.5 py-1 text-[11px] font-semibold text-text-muted sm:inline">
                        {state === "soon" ? "Starting soon" : "Scheduled"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel kicker="Your learning" title={profile.languageToLearn || "Getting started"}>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[12px] text-text-muted">
                <GraduationCap className="h-4 w-4 text-text-subtle" /> Level
              </dt>
              <dd className="rounded-md bg-brand/10 px-2 py-0.5 text-[12px] font-bold text-brand">{profile.proficiencyLevel || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[12px] text-text-muted">
                <CalendarDays className="h-4 w-4 text-text-subtle" /> This month
              </dt>
              <dd className="text-[13px] font-semibold text-text">
                <span className="font-mono">{stats.monthlyClasses}</span> class{stats.monthlyClasses === 1 ? "" : "es"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[12px] text-text-muted">
                <Timer className="h-4 w-4 text-text-subtle" /> Total time
              </dt>
              <dd className="font-mono text-[13px] font-semibold text-text">{stats.totalHours}h</dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-1 border-t border-border pt-4">
            {[
              { icon: Search, label: "Find a teacher", detail: "Browse and book a class", href: "/discover", tone: "bg-brand/10 text-brand" },
              { icon: Wallet, label: "Top up coins", detail: `${stats.coinBalance.toLocaleString("en-IN")} coins available`, href: "/wallet", tone: "bg-action/15 text-gold-strong" },
              { icon: UserRoundPen, label: "Edit profile", detail: "Language, level and photo", href: "/profile", tone: "bg-trust/10 text-trust" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-inset">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", item.tone)}>
                    <item.icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-text">{item.label}</span>
                    <span className="block truncate text-[11px] text-text-subtle">{item.detail}</span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ── Recent activity ────────────────────────────── */}
      <Panel
        kicker="Recent activity"
        title="Completed classes"
        action={
          <Link href="/recordings" className={panelLink}>
            Recordings <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {recentActivity.length === 0 ? (
          <p className="rounded-lg bg-surface-inset/60 px-4 py-6 text-center text-[13px] text-text-muted">
            Classes you finish will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                  {initials(a.teacher)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text">{a.teacher}</p>
                  <p className="text-[11px] text-text-subtle">
                    {a.type === "DEMO" ? "Demo class" : "Class"} · {a.language} ·{" "}
                    {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className="font-mono text-[12px] font-semibold text-text">₹{Math.round(a.amount / 100).toLocaleString("en-IN")}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-trust/10 px-2 py-1 text-[10px] font-bold text-trust">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" aria-hidden />
                  Completed
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

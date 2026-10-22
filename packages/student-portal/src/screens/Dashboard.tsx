"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  CalendarDays,
  Clock,
  Coins,
  GraduationCap,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { useJsonResource } from "@repo/ui/useResource";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { canJoin, getJoinState, useNow, type JoinState } from "@repo/classroom/join-window";
import { usePortal } from "../config";
import { clock, coins, countdown, dayLabel, DAY, plural, sameDay } from "../format";
import { LevelLadder, levelInfo } from "../LevelLadder";
import { Avatar, EmptyState, ErrorState, Panel, PanelHeader, Pill, Rise, Skeleton, Stagger, ease } from "../primitives";

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
  recentActivity?: Array<{ id: string; teacher: string; avatar: string | null; type: string; language: string; date: string; amount: number }>;
};

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function joinStateOf(c: UpcomingClass, now: number): JoinState {
  if (!c.scheduledStart || !c.scheduledEnd) return "upcoming";
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

const kindOf = (type: string) => (type === "DEMO" ? "Demo class" : "Class");

export function DashboardScreen() {
  const { href } = usePortal();
  const now = useNow();
  const { data, error, isStale, updatedAt, refetch } = useJsonResource<DashboardData>("/api/students/dashboard", {
    staleMs: 30_000,
    pollMs: 60_000,
  });

  if (error && !data) return <ErrorState title="We couldn't load your dashboard" onRetry={() => void refetch()} />;
  if (!data) return <DashboardSkeleton />;

  const { profile, stats, upcomingClasses } = data;
  const recentActivity = data.recentActivity ?? [];
  const firstName = profile.name.split(/\s+/)[0] || "there";
  const today = new Date(now);

  return (
    <Stagger className="space-y-5 pb-10">
      {isStale && <StaleDataNotice onRetry={() => void refetch()} updatedAt={updatedAt} />}

      <Rise as="header" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-text-subtle">
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="lm-page-title mt-1">
            {greeting(today.getHours())}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={href("/classes")}>
              <CalendarDays className="h-4 w-4" /> My classes
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href={href("/discover")}>
              <Search className="h-4 w-4" /> Find a teacher
            </Link>
          </Button>
        </div>
      </Rise>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Rise>
          <NextClassHero next={upcomingClasses[0]} now={now} language={levelInfo(profile.languageToLearn, "").languageName} />
        </Rise>
        <Rise>
          <LevelCard language={profile.languageToLearn} level={profile.proficiencyLevel} />
        </Rise>
      </div>

      <Rise>
        <StatsStrip stats={stats} />
      </Rise>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Rise>
          <WeekAgenda classes={upcomingClasses} now={now} language={levelInfo(profile.languageToLearn, "").languageName} />
        </Rise>
        <Rise>
          <Panel className="h-full">
            <PanelHeader
              title="Recently completed"
              action={
                <Link href={href("/classes")} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
                  History <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {recentActivity.length === 0 ? (
              <p className="mx-5 mb-5 rounded-lg bg-surface-inset/70 px-4 py-6 text-center text-[13px] text-text-muted">
                Classes you finish will show up here.
              </p>
            ) : (
              <ul className="px-2 pb-3">
                {recentActivity.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <Avatar name={a.teacher} src={a.avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-text">{a.teacher}</p>
                      <p className="truncate text-[12px] text-text-subtle">
                        {kindOf(a.type)} · {a.language} · {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums text-text-muted">{coins(a.amount)} coins</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </Rise>
      </div>
    </Stagger>
  );
}

/* ── Next class ─────────────────────────────────────────────────────────── */

function NextClassHero({ next, now, language }: { next?: UpcomingClass; now: number; language: string }) {
  const { href } = usePortal();

  if (!next || !next.scheduledStart || !next.scheduledEnd) {
    return (
      <section className="relative flex h-full min-h-[208px] flex-col justify-between overflow-hidden rounded-xl bg-navy p-6 text-cream shadow-level-2 dark:border dark:border-gold/15">
        <HeroGlow />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-soft">Up next</p>
          <p className="mt-3 max-w-md text-[22px] font-bold leading-tight tracking-[-0.02em]">Nothing booked yet</p>
          <p className="mt-1.5 max-w-md text-[13px] text-cream/65">
            Pick a teacher and a time that suits you{language ? ` to keep your ${language} going` : ""}. Your first class with a teacher can be a 45-minute demo for 29 coins.
          </p>
        </div>
        <div className="relative mt-5">
          <Button asChild variant="gold">
            <Link href={href("/discover")}>
              <CalendarPlus className="h-4 w-4" /> Book a class
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const start = new Date(next.scheduledStart);
  const end = new Date(next.scheduledEnd);
  const state = joinStateOf(next, now);
  const joinable = canJoin(state);
  const started = now >= start.getTime();
  const opensAt = new Date(next.joinOpensAt ?? start.getTime() - 10 * 60_000);
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);

  return (
    <section
      aria-label="Next class"
      className="relative flex h-full min-h-[208px] flex-col justify-between overflow-hidden rounded-xl bg-navy p-6 text-cream shadow-level-2 dark:border dark:border-gold/15"
    >
      <HeroGlow />
      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-soft">
          {joinable && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-gold opacity-60 motion-reduce:hidden" />
              <span className="relative h-2 w-2 rounded-full bg-gold" />
            </span>
          )}
          {state === "live" ? "In progress" : started ? "Happening now" : "Up next"}
        </p>
        <span className="rounded-full bg-cream/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-cream/80">
          {started ? `Ends ${clock(end)}` : `Starts ${countdown(start, now)}`}
        </span>
      </div>

      <div className="relative mt-5 flex items-center gap-4">
        <Avatar name={next.teacher} src={next.avatar} size="lg" tone="bg-cream/12 text-gold" className="rounded-full ring-2 ring-cream/15" />
        <div className="min-w-0">
          <p className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em]">{next.teacher}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-cream/70">
            <span className="rounded bg-cream/10 px-1.5 py-px text-[11px] font-bold text-cream/90">{next.language}</span>
            {kindOf(next.type)} · {mins} min
          </p>
        </div>
      </div>

      <div className="relative mt-6 flex flex-col gap-3 border-t border-cream/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[13px] text-cream/75">
          <Clock className="h-4 w-4 text-cream/45" />
          {dayLabel(start, now)} · {clock(start)} – {clock(end)}
        </p>
        {joinable ? (
          <Button asChild variant="gold">
            <Link href={href(`/live/${next.sessionId || next.id}`)}>
              <Video className="h-4 w-4" /> {state === "live" ? "Rejoin class" : "Join class"}
            </Link>
          </Button>
        ) : (
          <span className="text-[12px] text-cream/55">
            Join opens at <span className="font-semibold text-cream/85">{clock(opensAt)}</span>
            {!sameDay(opensAt, new Date(now)) && ` · ${dayLabel(opensAt, now)}`}
          </span>
        )}
      </div>
    </section>
  );
}

function HeroGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-accent/20 blur-3xl" aria-hidden />
    </>
  );
}

/* ── Level ──────────────────────────────────────────────────────────────── */

function LevelCard({ language, level }: { language: string; level: string }) {
  const { href } = usePortal();
  if (!language) {
    return (
      <Panel className="flex h-full flex-col justify-center p-6">
        <GraduationCap className="mb-3 h-5 w-5 text-text-subtle" />
        <p className="text-[15px] font-bold text-text">Set your language and level</p>
        <p className="mt-1 text-[13px] text-text-muted">Teachers use it to pitch your first class at the right level.</p>
        <Link href={href("/profile")} className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
          Open profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Panel>
    );
  }
  const info = levelInfo(language, level);
  const nextLevel = info.index >= 0 ? info.levels[info.index + 1] : undefined;
  return (
    <Panel className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-text-subtle">
            {info.languageName} · {info.system}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[34px] font-extrabold leading-none tracking-[-0.04em] text-text">{info.current?.shortLabel ?? "—"}</span>
            {info.label && <span className="text-[13px] font-semibold text-text-muted">{info.label.split("—")[1]?.trim()}</span>}
          </p>
        </div>
        <Link
          href={href("/profile")}
          className="rounded-lg px-2 py-1 text-[12px] font-semibold text-brand transition-colors hover:bg-brand/10 focus-ring"
        >
          Change
        </Link>
      </div>
      {info.description && <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{info.description}</p>}
      <LevelLadder language={language} value={level} className="mt-auto pt-5" />
      {nextLevel && (
        <p className="mt-3 text-[12px] text-text-subtle">
          Next: <span className="font-semibold text-text-secondary">{nextLevel.shortLabel}</span> ·{" "}
          {levelInfo(language, nextLevel.value).description}
        </p>
      )}
    </Panel>
  );
}

/* ── Stats ──────────────────────────────────────────────────────────────── */

function StatsStrip({ stats }: { stats: DashboardData["stats"] }) {
  const { href } = usePortal();
  const hours = stats.totalHours % 1 ? stats.totalHours.toFixed(1) : String(stats.totalHours);
  const cells = [
    {
      label: "Coin balance",
      value: coins(stats.coinBalance),
      helper: (
        <Link href={href("/wallet")} className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">
          Top up <ArrowUpRight className="h-3 w-3" />
        </Link>
      ),
      icon: Coins,
      tone: "bg-action/15 text-gold-strong",
    },
    {
      label: "Classes completed",
      value: String(stats.totalClasses),
      helper: stats.monthlyClasses ? `${stats.monthlyClasses} this month` : "None this month yet",
      icon: Sparkles,
      tone: "bg-trust/12 text-trust",
    },
    { label: "Hours learned", value: hours, helper: "In completed classes", icon: Clock, tone: "bg-brand/10 text-brand" },
    {
      label: "Teachers",
      value: String(stats.uniqueTeachers),
      helper: stats.uniqueTeachers ? `You've learned with ${plural(stats.uniqueTeachers, "teacher")}` : "Book a demo to meet one",
      icon: GraduationCap,
      tone: "bg-accent/15 text-accent",
    },
  ];
  return (
    // Hairline dividers: the gaps let the border colour show through, so the
    // lines stay right at both the 2-column and the 4-column breakpoint.
    <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-border lg:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="flex items-center gap-3.5 bg-surface p-4 sm:p-5">
          <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex", c.tone)}>
            <c.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-text-subtle">{c.label}</p>
            <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-text">{c.value}</p>
            <p className="truncate text-[11px] text-text-subtle">{c.helper}</p>
          </div>
        </div>
      ))}
    </Panel>
  );
}

/* ── Week agenda ────────────────────────────────────────────────────────── */

function WeekAgenda({ classes, now, language }: { classes: UpcomingClass[]; now: number; language: string }) {
  const { href } = usePortal();
  const [selected, setSelected] = useState<number | null>(null);

  // Keyed on the start of today, so the strip moves on once a day rather
  // than rebuilding on every 15 s tick.
  const today = new Date(now).setHours(0, 0, 0, 0);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today + i * DAY);
        return { date: d, classes: classes.filter((c) => c.scheduledStart && sameDay(new Date(c.scheduledStart), d)) };
      }),
    [classes, today]
  );

  const visible = selected === null ? classes : days[selected]!.classes;

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Your next 7 days"
        meta={classes.length ? `${plural(classes.length, "class", "classes")} booked` : undefined}
        action={
          <Link href={href("/classes")} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
            All classes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid grid-cols-7 gap-1.5 px-5" role="group" aria-label="Filter by day">
        {days.map((d, i) => {
          const active = selected === i;
          const count = d.classes.length;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? null : i)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors focus-ring",
                active
                  ? "border-brand bg-brand text-brand-on dark:text-navy"
                  : count
                    ? "border-border bg-surface hover:border-border-strong"
                    : "border-transparent bg-surface-inset/60 text-text-subtle hover:bg-surface-inset"
              )}
            >
              <span className={cn("text-[10px] font-bold uppercase tracking-[0.08em]", !active && "text-text-subtle")}>
                {i === 0 ? "Today" : d.date.toLocaleDateString("en-GB", { weekday: "short" })}
              </span>
              <span className={cn("text-[16px] font-extrabold tabular-nums leading-none", !active && (count ? "text-text" : "text-text-subtle"))}>
                {d.date.getDate()}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-label={count ? plural(count, "class", "classes") : "No classes"}>
                {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                  <span key={k} className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-current" : "bg-action")} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-2 pb-3 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected ?? "all"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease }}
          >
            {visible.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                className="py-10"
                title={selected === null ? "No classes booked" : `Nothing on ${dayLabel(days[selected]!.date, now)}`}
                body={selected === null ? `Book a class to keep your ${language || "learning"} going.` : "Pick another day, or book a class for this one."}
                action={
                  <Button asChild size="sm" variant="primary">
                    <Link href={href("/discover")}>Find a teacher</Link>
                  </Button>
                }
              />
            ) : (
              <ul>
                {visible.map((c) => (
                  <AgendaRow key={c.id} c={c} now={now} />
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function AgendaRow({ c, now }: { c: UpcomingClass; now: number }) {
  const { href } = usePortal();
  const start = c.scheduledStart ? new Date(c.scheduledStart) : null;
  const end = c.scheduledEnd ? new Date(c.scheduledEnd) : null;
  const state = joinStateOf(c, now);
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-inset/60">
      <div className="w-[68px] shrink-0 tabular-nums">
        <p className="text-[13px] font-bold text-text">{start ? clock(start) : "TBD"}</p>
        <p className="text-[11px] text-text-subtle">{start ? dayLabel(start, now) : ""}</p>
      </div>
      <span className={cn("w-[3px] self-stretch rounded-full", canJoin(state) ? "bg-action" : "bg-brand/30")} aria-hidden />
      <Avatar name={c.teacher} src={c.avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-text">{c.teacher}</p>
        <p className="truncate text-[12px] text-text-subtle">
          {c.language} · {kindOf(c.type)}
          {start && end && <span className="hidden sm:inline"> · until {clock(end)}</span>}
        </p>
      </div>
      {canJoin(state) ? (
        <Button asChild size="sm" variant="gold">
          <Link href={href(`/live/${c.sessionId || c.id}`)}>
            <Video className="h-3.5 w-3.5" /> {state === "live" ? "Rejoin" : "Join"}
          </Link>
        </Button>
      ) : (
        <Pill tone={state === "soon" ? "action" : "neutral"} className="hidden sm:inline-flex">
          {state === "soon" && start ? `Starts ${countdown(start, now)}` : "Scheduled"}
        </Pill>
      )}
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Skeleton className="h-[208px] rounded-xl" />
        <Skeleton className="h-[208px] rounded-xl" />
      </div>
      <Skeleton className="h-[92px] rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

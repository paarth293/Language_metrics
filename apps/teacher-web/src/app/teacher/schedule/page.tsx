"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  Settings2,
  Timer,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useNow } from "@/lib/class-join";
import { WeekGrid } from "@/components/schedule/WeekGrid";
import { ListView } from "@/components/schedule/ListView";
import { AvailabilityEditor } from "@/components/schedule/AvailabilityEditor";
import { AvailabilitySummary, DayAgenda } from "@/components/schedule/ScheduleSidebar";
import {
  type AvailabilitySlot,
  type ScheduleSession,
  TONE_LABEL,
  TONE_STYLES,
  addDays,
  dayKey,
  formatDuration,
  formatRelativeStart,
  formatTime,
  formatWeekRange,
  getHourRange,
  getSessionTone,
  sessionMinutes,
  startOfWeek,
} from "@/components/schedule/schedule-utils";

type View = "week" | "list";

const SMALL_SCREEN = "(max-width: 767px)";
function useIsSmallScreen() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SMALL_SCREEN);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(SMALL_SCREEN).matches,
    () => false
  );
}

export default function TeacherSchedule() {
  // Ticks so Join buttons and the "now" line stay current without a reload.
  const now = useNow();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => addDays(startOfWeek(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekKey = dayKey(weekStart);

  const [sessions, setSessions] = useState<ScheduleSession[]>([]);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // null until loaded, so an empty "not set" state never flashes while fetching.
  const [loadedAvailability, setAvailability] = useState<AvailabilitySlot[] | null>(null);
  const availability = useMemo(() => loadedAvailability ?? [], [loadedAvailability]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const isSmallScreen = useIsSmallScreen();
  const [chosenView, setChosenView] = useState<View | null>(null);
  const view: View = chosenView ?? (isSmallScreen ? "list" : "week");

  // ── Data ──────────────────────────────────────────────────────────────
  // Any response for the week on screen is usable, so a duplicate or slower
  // request never makes us wait; responses for weeks already left are dropped.
  const shownWeek = useRef(weekKey);
  const loadWeek = useCallback(async (start: Date) => {
    const key = dayKey(start);
    setIsFetching(true);
    try {
      const params = new URLSearchParams({ from: start.toISOString(), to: addDays(start, 7).toISOString() });
      const res = await fetch(`/api/teachers/schedule?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Working hours ride along with every week, so they are always current.
      setAvailability(data.availability ?? []);
      if (key !== shownWeek.current) return;
      setSessions(data.sessions ?? []);
      setLoadedWeek(key);
      setLoadError(false);
    } catch (err) {
      console.error("Error loading schedule:", err);
      if (key === shownWeek.current) setLoadError(true);
    } finally {
      if (key === shownWeek.current) setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    shownWeek.current = dayKey(weekStart);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWeek(weekStart);
    // Refresh so a class turns "Live" once the student is in the room.
    const t = setInterval(() => loadWeek(weekStart), 60_000);
    return () => clearInterval(t);
  }, [loadWeek, weekStart]);

  // ── Derived ───────────────────────────────────────────────────────────
  const weekSessions = useMemo(
    () => (loadedWeek === weekKey ? sessions : []),
    [sessions, loadedWeek, weekKey]
  );

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ScheduleSession[]>();
    for (const s of weekSessions) {
      const key = dayKey(new Date(s.scheduledStart));
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));
    return map;
  }, [weekSessions]);

  const hourRange = useMemo(() => getHourRange(weekSessions, availability), [weekSessions, availability]);

  const stats = useMemo(() => {
    const active = weekSessions.filter((s) => getSessionTone(s, now) !== "cancelled");
    const upcoming = active
      .filter((s) => ["live", "open", "soon", "upcoming", "pending"].includes(getSessionTone(s, now)))
      .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));
    return {
      classes: active.length,
      minutes: active.reduce((n, s) => n + sessionMinutes(s), 0),
      students: new Set(active.map((s) => s.student.userId)).size,
      next: upcoming.find((s) => getSessionTone(s, now) === "live") ?? upcoming[0] ?? null,
    };
  }, [weekSessions, now]);

  const weekIsPast = addDays(weekStart, 7).getTime() <= now;

  // ── Actions ───────────────────────────────────────────────────────────
  const goToWeek = (offset: number) => {
    setWeekOffset(offset);
    setLoadError(false);
    const start = addDays(startOfWeek(new Date()), offset * 7);
    setSelectedDay(offset === 0 ? new Date() : start);
    setSelectedSessionId(null);
  };

  const selectSession = (s: ScheduleSession) => {
    setSelectedDay(new Date(s.scheduledStart));
    setSelectedSessionId(s.id);
  };

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const onAvailabilitySaved = (slots: AvailabilitySlot[]) => {
    setAvailability(slots);
    setDrawerOpen(false);
    setToast("Working hours saved");
    setTimeout(() => setToast(null), 3000);
  };

  const initialLoading = loadedWeek === null && !loadError;
  const selectedDaySessions = sessionsByDay.get(dayKey(selectedDay)) ?? [];

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ── Header ───────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="lm-page-title">
            Schedule
          </h1>
          <p className="mt-1 text-[15px] font-medium text-text-muted">See who you&apos;re teaching and when, and keep your hours up to date.</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)} className="self-start sm:self-auto shadow-sm">
          <Settings2 className="mr-2 h-4 w-4" /> Working hours
        </Button>
      </div>

      {/* ── Week at a glance ─────────────────────────── */}
      {loadedWeek !== weekKey && !loadError ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="h-[140px] animate-pulse rounded-2xl bg-surface-inset" />
          <div className="h-[140px] animate-pulse rounded-2xl bg-surface-inset" />
          <div className="h-[140px] animate-pulse rounded-2xl bg-surface-inset" />
          <div className="h-[140px] animate-pulse rounded-2xl bg-surface-inset" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <NextUpTile session={stats.next} now={now} weekIsPast={weekIsPast} />
          <StatTile icon={CalendarDays} label="Classes" value={String(stats.classes)} sub="this week" />
          <StatTile icon={Timer} label="Teaching" value={stats.minutes ? formatDuration(stats.minutes) : "0h"} sub="booked" />
          <StatTile icon={Users} label="Students" value={String(stats.students)} sub={stats.students === 1 ? "learner" : "learners"} />
        </div>
      )}

      {/* ── Calendar + sidebar ───────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="lm-panel p-0 overflow-hidden" aria-label="Calendar">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-1">
              <IconButton label="Previous week" onClick={() => goToWeek(weekOffset - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton label="Next week" onClick={() => goToWeek(weekOffset + 1)}>
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
            <h2 className="font-display text-[17px] font-bold tracking-[-0.01em] text-text sm:text-[18px]">
              {formatWeekRange(weekStart)}
            </h2>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => goToWeek(0)}
                className="rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand focus-ring"
              >
                Today
              </button>
            )}
            {isFetching && !initialLoading && <Loader2 className="h-4 w-4 animate-spin text-text-subtle" aria-label="Loading" />}

            <div className="ml-auto flex rounded-full bg-surface-inset p-1" role="tablist" aria-label="Calendar view">
              {(
                [
                  { id: "week", label: "Week", Icon: LayoutGrid },
                  { id: "list", label: "List", Icon: List },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setChosenView(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all focus-ring",
                    view === id ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          {loadError && loadedWeek !== weekKey ? (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-alert" />
              <p className="text-[15px] font-semibold text-text">We couldn&apos;t load this week</p>
              <Button variant="outline" size="sm" onClick={() => loadWeek(weekStart)}>
                Try again
              </Button>
            </div>
          ) : initialLoading || loadedWeek !== weekKey ? (
            <div className="space-y-3 p-5" aria-busy="true">
              <div className="h-14 animate-pulse rounded-xl bg-surface-inset" />
              <div className="h-[420px] animate-pulse rounded-xl bg-surface-inset/70" />
            </div>
          ) : view === "week" ? (
            <>
              <WeekGrid
                days={days}
                sessionsByDay={sessionsByDay}
                availability={availability}
                hourRange={hourRange}
                now={now}
                selectedDay={selectedDay}
                selectedSessionId={selectedSessionId}
                onSelectDay={(d) => {
                  setSelectedDay(d);
                  setSelectedSessionId(null);
                }}
                onSelectSession={selectSession}
              />
              <Legend />
            </>
          ) : (
            <ListView days={days} sessionsByDay={sessionsByDay} now={now} selectedSessionId={selectedSessionId} />
          )}
        </section>

        <aside className="space-y-6">
          {view === "week" && (
            <DayAgenda
              day={selectedDay}
              sessions={selectedDaySessions}
              availability={availability}
              availabilityLoading={loadedAvailability === null}
              now={now}
              selectedSessionId={selectedSessionId}
            />
          )}
          <AvailabilitySummary
            availability={availability}
            loading={loadedAvailability === null}
            now={now}
            onEdit={() => setDrawerOpen(true)}
          />
        </aside>
      </div>

      <AvailabilityEditor
        open={drawerOpen}
        availability={availability}
        onClose={closeDrawer}
        onSaved={onAvailabilitySaved}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-text px-4 py-2.5 text-[13px] font-semibold text-bg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <CheckCircle2 className="h-4 w-4 text-trust" /> {toast}
        </div>
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand focus-ring"
    >
      {children}
    </button>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <article className="lm-panel flex flex-col justify-between p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-subtle leading-tight">
          {label}
        </h3>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="font-mono text-[32px] font-semibold text-text leading-none">{value}</span>
        <span className="text-[13px] font-medium text-text-muted mb-1">{sub}</span>
      </div>
    </article>
  );
}

function NextUpTile({ session, now, weekIsPast }: { session: ScheduleSession | null; now: number; weekIsPast: boolean }) {
  const tone = session ? getSessionTone(session, now) : null;
  const joinable = tone === "live" || tone === "open";
  const started = !!session && now >= Date.parse(session.scheduledStart);

  return (
    <article className="lm-panel bg-navy text-cream overflow-hidden border-none relative flex flex-col justify-between p-6 shadow-md dark:border dark:border-gold/20">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-cream/70 leading-tight">
          {tone === "live" ? "In progress" : started ? "Happening now" : "Up next"}
        </h3>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream/10 text-gold">
          <Clock size={16} strokeWidth={1.8} />
        </span>
      </div>

      {session && tone ? (
        <div className="relative flex flex-col gap-4 mt-auto">
          <div>
            <p className="font-display text-[22px] font-bold leading-tight truncate">{session.student.name}</p>
            <p className="mt-1.5 text-[13px] font-medium text-cream/70">
              {started
                ? `Started ${formatTime(new Date(session.scheduledStart))} · until ${formatTime(new Date(session.scheduledEnd))}`
                : formatRelativeStart(new Date(session.scheduledStart), now)}
            </p>
          </div>
          {joinable ? (
            <Button asChild variant="gold" size="sm" className="w-full text-[13px] h-9">
              <Link href={`/live/${session.id}`}>
                <Video className="mr-2 h-4 w-4" /> {tone === "live" ? "Rejoin class" : "Join class"}
              </Link>
            </Button>
          ) : (
            tone === "pending" && (
              <span className="self-start rounded-full bg-cream/10 px-3 py-1 text-[11px] font-semibold text-cream">Pending</span>
            )
          )}
        </div>
      ) : (
        <div className="relative flex flex-col mt-auto">
          <p className="font-display text-[22px] font-bold leading-tight">{weekIsPast ? "Week complete" : "All clear"}</p>
          <p className="mt-1.5 text-[13px] font-medium text-cream/70">
            {weekIsPast ? "Nothing left to teach this week." : "No upcoming classes this week."}
          </p>
        </div>
      )}
    </article>
  );
}

function Legend() {
  const items = (["upcoming", "soon", "live", "pending", "completed", "cancelled"] as const).map((t) => ({
    tone: t,
    label: t === "upcoming" ? "Scheduled" : TONE_LABEL[t],
  }));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-5 py-3 text-[11px] text-text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-sm border-l-2 border-trust/30 bg-trust/[0.12]" /> Working hours
      </span>
      {items.map(({ tone, label }) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-1 rounded-full", TONE_STYLES[tone].bar)} /> {label}
        </span>
      ))}
      <span className="ml-auto flex items-center gap-1.5 text-text-subtle">
        <Clock className="h-3 w-3" /> {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </span>
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CalendarPlus, CalendarX2, CheckCircle2, History, Loader2, Star, Video, XCircle } from "lucide-react";
import { useJsonResource } from "@repo/ui/useResource";
import { useStickyState } from "@repo/ui/useStickyState";
import { invalidateResource } from "@repo/ui/resource-cache";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { canJoin, getJoinState, useNow, type JoinState } from "@repo/classroom/join-window";
import { usePortal } from "../config";
import { clock, countdown, dayLabel, dayPhrase, HOUR, MINUTE } from "../format";
import { Avatar, Dialog, EmptyState, ErrorState, InlineError, PageHeader, Pill, Segmented, Skeleton, ease } from "../primitives";

type Session = {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  joinOpensAt?: string;
  joinClosesAt?: string;
};

type Booking = {
  id: string;
  teacher: string;
  avatar: string | null;
  language: string;
  type: string;
  status: string;
  totalSessions: number;
  completedSessions: number;
  nextSession: Session | null;
  /** Past its join window, waiting for automatic settlement. */
  endedSession?: { scheduledStart: string; scheduledEnd: string } | null;
  review: { rating: number; comment: string | null } | null;
  amountPaid: number;
  scheduledStart?: string;
  createdAt: string;
};

type Tab = "upcoming" | "past" | "cancelled";

/** Free cancellation closes this long before the start (enforced by the cancel route). */
const CANCEL_CUTOFF_MS = 12 * HOUR;

const kindOf = (type: string) => (type === "DEMO" ? "Demo class" : type === "COURSE" ? "Course" : "Class");

function stateOf(s: Session, now: number): JoinState {
  return getJoinState(s, now);
}

/** The date a booking is filed under in the agenda. */
function anchorOf(b: Booking) {
  return b.nextSession?.scheduledStart ?? b.endedSession?.scheduledStart ?? b.scheduledStart ?? b.createdAt;
}

export function ClassesScreen() {
  const { href, fetch, features } = usePortal();
  const now = useNow();
  const [tab, setTab] = useStickyState<Tab>("classes:tab", "upcoming");
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<{ booking: Booking; session: Session } | null>(null);

  // One cache key per tab: switching back is instant and a tab never shows
  // another tab's bookings while it loads.
  const { data, error, isLoading, isStale, updatedAt, refetch } = useJsonResource<{ bookings: Booking[] }>(
    `/api/students/classes?filter=${tab}`,
    { staleMs: 30_000 }
  );

  const groups = useMemo(() => {
    const bookings = [...(data?.bookings ?? [])].sort((a, b) =>
      tab === "upcoming"
        ? Date.parse(anchorOf(a)) - Date.parse(anchorOf(b))
        : Date.parse(anchorOf(b)) - Date.parse(anchorOf(a))
    );
    const out: { label: string; items: Booking[] }[] = [];
    for (const b of bookings) {
      const d = new Date(anchorOf(b));
      // Upcoming reads like a diary (by day); history reads like a log (by month).
      const label =
        tab === "upcoming"
          ? `${dayLabel(d, now)}${["Today", "Tomorrow"].includes(dayLabel(d, now)) ? ` · ${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}` : ""}`
          : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(b);
      else out.push({ label, items: [b] });
    }
    return out;
  }, [data, tab, now]);

  const count = data?.bookings.length ?? 0;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="My classes"
        description="Join, move or cancel your bookings, and look back at what you've covered."
        actions={
          <Button asChild variant="primary">
            <Link href={href("/discover")}>
              <CalendarPlus className="h-4 w-4" /> Book a class
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Tab>
          label="Classes"
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        {data && count > 0 && (
          <p className="text-[12px] text-text-subtle">
            {count} {tab === "upcoming" ? "booked" : tab === "past" ? "completed" : "cancelled"}
          </p>
        )}
      </div>

      {isStale && <StaleDataNotice onRetry={() => void refetch()} updatedAt={updatedAt} />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease }}
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[104px] rounded-xl" />
              ))}
            </div>
          ) : error && !data ? (
            <ErrorState title="We couldn't load your classes" onRetry={() => void refetch()} />
          ) : count === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong">
              {tab === "upcoming" ? (
                <EmptyState
                  icon={CalendarPlus}
                  title="No classes booked"
                  body="Find a teacher and pick a time. A 45-minute demo is the easiest way to start."
                  action={
                    <Button asChild variant="gold">
                      <Link href={href("/discover")}>Find a teacher</Link>
                    </Button>
                  }
                />
              ) : tab === "past" ? (
                <EmptyState icon={History} title="No past classes yet" body="Classes you finish will be kept here." />
              ) : (
                <EmptyState icon={CalendarX2} title="Nothing cancelled" body="Classes you or a teacher cancel will show up here." />
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label}>
                  <h2 className="mb-2.5 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.12em] text-text-subtle">
                    {g.label}
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </h2>
                  <ul className="space-y-2.5">
                    {g.items.map((b) => (
                      <ClassRow
                        key={b.id}
                        booking={b}
                        tab={tab}
                        now={now}
                        onCancel={() => setCancelling(b)}
                        onReschedule={
                          features.reschedule && b.nextSession
                            ? () => setRescheduling({ booking: b, session: b.nextSession! })
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} fetchImpl={fetch} now={now} />
      <RescheduleDialog target={rescheduling} onClose={() => setRescheduling(null)} fetchImpl={fetch} now={now} />
    </div>
  );
}

/* ── Row ────────────────────────────────────────────────────────────────── */

function ClassRow({
  booking: b,
  tab,
  now,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  tab: Tab;
  now: number;
  onCancel: () => void;
  onReschedule?: () => void;
}) {
  const { href } = usePortal();
  const session = b.nextSession;
  const state = session ? stateOf(session, now) : null;
  const joinable = state ? canJoin(state) : false;
  const start = session ? new Date(session.scheduledStart) : null;
  const end = session ? new Date(session.scheduledEnd) : null;
  const minutes = start && end ? Math.round((end.getTime() - start.getTime()) / MINUTE) : null;
  const cancellable = tab === "upcoming" && !!start && start.getTime() - now > CANCEL_CUTOFF_MS;
  const anchor = new Date(anchorOf(b));

  const rail =
    tab === "cancelled" ? "bg-alert/40" : tab === "past" ? "bg-trust/50" : joinable ? "bg-action" : state === "soon" ? "bg-action/50" : "bg-brand/30";

  return (
    <li
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border bg-surface shadow-level-1 transition-colors sm:flex-row",
        joinable ? "border-action/50" : "border-border",
        tab === "cancelled" && "opacity-80"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", rail)} aria-hidden />

      {/* Time */}
      <div className="flex shrink-0 items-baseline gap-2 border-b border-border px-5 pb-3 pt-4 pl-6 sm:w-[132px] sm:flex-col sm:gap-0.5 sm:border-b-0 sm:border-r sm:py-4">
        {tab === "upcoming" && start ? (
          <>
            <span className="text-[20px] font-extrabold tracking-[-0.03em] tabular-nums text-text">{clock(start)}</span>
            <span className="text-[12px] tabular-nums text-text-subtle">
              {end ? `to ${clock(end)}` : ""}
              {minutes ? (
                <span className="sm:block">
                  <span className="sm:hidden"> · </span>
                  {minutes} min
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <>
            <span className="text-[20px] font-extrabold tracking-[-0.03em] tabular-nums text-text">{anchor.getDate()}</span>
            {/* Past and cancelled bookings carry no session time, so this is the booking date. */}
            <span className="text-[12px] text-text-subtle">Booked · {anchor.toLocaleDateString("en-GB", { month: "short" })}</span>
          </>
        )}
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 items-center gap-3.5 px-5 py-4">
        <Avatar name={b.teacher} src={b.avatar} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-text">{b.teacher}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
            <span className="rounded-md bg-surface-inset px-1.5 py-px text-[11px] font-semibold text-text-secondary">{b.language}</span>
            <span>{kindOf(b.type)}</span>
            {b.totalSessions > 1 && (
              <span className="text-text-subtle">
                · {b.completedSessions} of {b.totalSessions} sessions done
              </span>
            )}
          </div>
          <div className="mt-2">
            <StatusLine booking={b} tab={tab} state={state} start={start} now={now} />
          </div>
        </div>
      </div>

      {/* Actions */}
      {tab === "upcoming" && (
        <div className="flex shrink-0 flex-col justify-center gap-2 border-t border-border px-5 py-4 sm:w-[220px] sm:border-l sm:border-t-0">
          {joinable && session ? (
            <Button asChild variant="gold" className="w-full">
              <Link href={href(`/live/${session.id}`)}>
                <Video className="h-4 w-4" /> {state === "live" ? "Rejoin class" : "Join class"}
              </Link>
            </Button>
          ) : session ? (
            <p className="text-center text-[12px] text-text-subtle sm:text-left">
              Join opens {clock(new Date(session.joinOpensAt ?? Date.parse(session.scheduledStart) - 10 * MINUTE))}
            </p>
          ) : null}
          {session && (
            <div className="flex gap-1">
              {onReschedule && (
                <Button variant="ghost" size="sm" className="flex-1" onClick={onReschedule}>
                  <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={cn("flex-1", cancellable && "hover:bg-alert/10 hover:text-alert")}
                onClick={onCancel}
                disabled={!cancellable}
                title={cancellable ? undefined : "Free cancellation closes 12 hours before class"}
              >
                <CalendarX2 className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          )}
          {session && !cancellable && (
            <p className="text-center text-[11px] text-text-subtle sm:text-left">Cancellation closed 12 h before start</p>
          )}
        </div>
      )}
    </li>
  );
}

function StatusLine({ booking: b, tab, state, start, now }: { booking: Booking; tab: Tab; state: JoinState | null; start: Date | null; now: number }) {
  if (tab === "cancelled") {
    return (
      <Pill tone="alert">
        <XCircle className="h-3 w-3" /> Cancelled
      </Pill>
    );
  }
  if (tab === "past") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Pill tone="trust">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Pill>
        {b.review && (
          <span className="inline-flex items-center gap-0.5" aria-label={`You rated this class ${b.review.rating} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={cn("h-3.5 w-3.5", i < b.review!.rating ? "fill-action text-action" : "text-border-strong")} />
            ))}
          </span>
        )}
      </span>
    );
  }
  if (!b.nextSession) {
    return b.endedSession ? (
      <Pill tone="neutral">Ended {clock(new Date(b.endedSession.scheduledEnd))} · settling automatically</Pill>
    ) : (
      <Pill tone="neutral">Waiting for a time</Pill>
    );
  }
  if (state === "live") return <Pill tone="trust" dot>In progress</Pill>;
  if (state === "open") return <Pill tone="action" dot>Classroom open</Pill>;
  if (state === "soon" && start) return <Pill tone="action">Starts {countdown(start, now)}</Pill>;
  return <Pill tone="brand">{b.status === "PENDING" ? "Awaiting confirmation" : "Confirmed"}</Pill>;
}

/* ── Dialogs ────────────────────────────────────────────────────────────── */

async function errorFrom(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return body?.error || body?.message || fallback;
}

function CancelDialog({ booking, onClose, fetchImpl, now }: { booking: Booking | null; onClose: () => void; fetchImpl: typeof fetch; now: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = booking?.nextSession ? new Date(booking.nextSession.scheduledStart) : null;

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchImpl(`/api/students/classes/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await errorFrom(res, "Failed to cancel booking"));
      // Cancelling moves the booking between tabs, so drop all of them.
      invalidateResource("/api/students/classes");
      invalidateResource("/api/students/dashboard");
      invalidateResource("/api/students/wallet");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!booking}
      onClose={close}
      busy={busy}
      title="Cancel this class?"
      icon={
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-alert/10 text-alert">
          <CalendarX2 className="h-5 w-5" />
        </span>
      }
      description={
        booking && start ? (
          <>
            {kindOf(booking.type)} with <span className="font-semibold text-text">{booking.teacher}</span> {dayPhrase(start, now)} at {clock(start)}.
          </>
        ) : null
      }
    >
      <p className="rounded-lg border border-border bg-surface-inset px-4 py-3 text-[13px] leading-relaxed text-text-muted">
        It is more than 12 hours away, so the coins held for it go back to your wallet in full.
      </p>
      {error && <InlineError className="mt-4">{error}</InlineError>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={close} disabled={busy}>
          Keep class
        </Button>
        <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarX2 className="h-4 w-4" />}
          Cancel class
        </Button>
      </div>
    </Dialog>
  );
}

/** Offsets the reschedule route accepts: within an hour either side, in 15-minute steps. */
const OFFSETS = [-60, -45, -30, -15, 15, 30, 45, 60];

function RescheduleDialog({
  target,
  onClose,
  fetchImpl,
  now,
}: {
  target: { booking: Booking; session: Session } | null;
  onClose: () => void;
  fetchImpl: typeof fetch;
  now: number;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const original = target ? new Date(target.session.scheduledStart) : null;

  const close = () => {
    setChoice(null);
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!target || !original || choice === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchImpl(`/api/students/classes/${target.session.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // A full ISO timestamp: the route parses it with `new Date()`, and a
        // bare datetime-local value would be read in the server's time zone.
        body: JSON.stringify({ newStartTime: new Date(original.getTime() + choice * MINUTE).toISOString() }),
      });
      if (!res.ok) throw new Error(await errorFrom(res, "Failed to reschedule booking"));
      invalidateResource("/api/students/classes");
      invalidateResource("/api/students/dashboard");
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule booking");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!target}
      onClose={close}
      busy={busy}
      title="Move this class"
      icon={
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <CalendarClock className="h-5 w-5" />
        </span>
      }
      description={
        target && original ? (
          <>
            Booked {dayPhrase(original, now)} at <span className="font-semibold text-text">{clock(original)}</span> with {target.booking.teacher}. You can move it
            up to an hour either way, if the teacher is free.
          </>
        ) : null
      }
    >
      {original && (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="New start time">
          {OFFSETS.map((offset) => {
            const t = new Date(original.getTime() + offset * MINUTE);
            const past = t.getTime() <= now;
            const selected = choice === offset;
            return (
              <button
                key={offset}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={past || busy}
                onClick={() => setChoice(offset)}
                className={cn(
                  "flex flex-col items-center rounded-lg border py-2 transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40",
                  selected ? "border-brand bg-brand text-brand-on dark:text-navy" : "border-border bg-surface hover:border-border-strong"
                )}
              >
                <span className="text-[13px] font-bold tabular-nums">{clock(t)}</span>
                <span className={cn("text-[10px]", selected ? "opacity-80" : "text-text-subtle")}>
                  {offset > 0 ? "+" : "−"}
                  {Math.abs(offset)} min
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && <InlineError className="mt-4">{error}</InlineError>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={close} disabled={busy}>
          Keep time
        </Button>
        <Button variant="primary" onClick={() => void confirm()} disabled={busy || choice === null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          Move class
        </Button>
      </div>
    </Dialog>
  );
}

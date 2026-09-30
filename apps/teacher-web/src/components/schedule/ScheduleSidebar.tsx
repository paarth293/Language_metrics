"use client";

import React, { useEffect } from "react";
import { CalendarCheck2, Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { SessionRow } from "./SessionRow";
import {
  type AvailabilitySlot,
  type ScheduleSession,
  DAY_NAMES,
  DAY_SHORT,
  WEEK_ORDER,
  formatClock,
  formatDuration,
  isSameDay,
  timeToMinutes,
} from "./schedule-utils";

const panel = "rounded-2xl border border-border bg-surface shadow-level-1";

export function DayAgenda({
  day,
  sessions,
  availability,
  availabilityLoading,
  now,
  selectedSessionId,
}: {
  day: Date;
  sessions: ScheduleSession[];
  availability: AvailabilitySlot[];
  availabilityLoading: boolean;
  now: number;
  selectedSessionId: string | null;
}) {
  const isToday = isSameDay(day, new Date(now));
  const slots = availability
    .filter((a) => a.dayOfWeek === day.getDay())
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  useEffect(() => {
    if (!selectedSessionId) return;
    document.getElementById(`agenda-${selectedSessionId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedSessionId]);

  return (
    <section className={panel} aria-label="Selected day">
      <div className="border-b border-border px-5 pb-4 pt-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.01em] text-text">
            {isToday ? "Today" : DAY_NAMES[day.getDay()]}
          </h2>
          <span className="text-[12px] font-semibold text-text-muted">
            {sessions.length} class{sessions.length !== 1 ? "es" : ""}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-text-muted">
          {day.toLocaleDateString("en-US", { weekday: isToday ? "long" : undefined, day: "numeric", month: "long", year: "numeric" })}
        </p>
        {availabilityLoading ? (
          <div className="mt-3 h-4 w-44 animate-pulse rounded bg-surface-inset" />
        ) : (
          <p className="mt-3 flex items-start gap-2 text-[12px] text-text-muted">
            <Clock className="mt-px h-3.5 w-3.5 shrink-0 text-trust" />
            {slots.length ? (
              <span>
                Available {slots.map((s) => `${formatClock(s.startTime)} – ${formatClock(s.endTime)}`).join(", ")}
              </span>
            ) : (
              <span>Not available on {DAY_NAMES[day.getDay()]}s</span>
            )}
          </p>
        )}
      </div>

      <div className="max-h-[480px] overflow-y-auto p-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-inset">
              <CalendarCheck2 className="h-5 w-5 text-text-subtle" />
            </span>
            <p className="text-[14px] font-semibold text-text">No classes</p>
            <p className="text-[12px] text-text-muted">
              {slots.length ? "Your hours are open for bookings." : "Enjoy the day off."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} id={`agenda-${s.id}`} className="scroll-m-3">
                <SessionRow session={s} now={now} compact highlighted={s.id === selectedSessionId} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AvailabilitySummary({
  availability,
  loading,
  now,
  onEdit,
}: {
  availability: AvailabilitySlot[];
  loading: boolean;
  now: number;
  onEdit: () => void;
}) {
  if (loading) {
    return (
      <section className={cn(panel, "space-y-3 p-5")} aria-label="Working hours" aria-busy="true">
        <div className="h-5 w-32 animate-pulse rounded bg-surface-inset" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-6 animate-pulse rounded-lg bg-surface-inset/70" />
        ))}
      </section>
    );
  }

  const todayDow = new Date(now).getDay();
  const totalMinutes = availability.reduce(
    (n, s) => n + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)),
    0
  );

  return (
    <section className={panel} aria-label="Working hours">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="font-display text-[17px] font-bold text-text">Working hours</h2>
          <p className="text-[12px] text-text-muted">
            {availability.length ? `${formatDuration(totalMinutes)} open each week` : "Not set yet"}
          </p>
        </div>
        {availability.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 px-3 text-[12px] text-brand hover:text-brand">
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      {availability.length === 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-dashed border-border-strong p-4 text-center">
          <p className="text-[13px] text-text-muted">Add your working hours so students know when they can book you.</p>
          <Button variant="primary" size="sm" onClick={onEdit} className="mt-3">
            Set working hours
          </Button>
        </div>
      ) : (
        <ul className="px-3 pb-3">
          {WEEK_ORDER.map((day) => {
            const slots = availability
              .filter((a) => a.dayOfWeek === day)
              .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            return (
              <li
                key={day}
                className={cn(
                  "flex items-start gap-3 rounded-lg px-2 py-2",
                  day === todayDow && "bg-surface-inset/70"
                )}
              >
                <span
                  className={cn(
                    "w-9 shrink-0 pt-0.5 text-[12px] font-bold",
                    day === todayDow ? "text-brand" : "text-text-secondary"
                  )}
                >
                  {DAY_SHORT[day]}
                </span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {slots.length ? (
                    slots.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-trust/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-trust"
                      >
                        {formatClock(s.startTime)} – {formatClock(s.endTime)}
                      </span>
                    ))
                  ) : (
                    <span className="pt-0.5 text-[12px] text-text-subtle">Off</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

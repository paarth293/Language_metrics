"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  type AvailabilitySlot,
  type ScheduleSession,
  DAY_SHORT,
  TONE_LABEL,
  TONE_STYLES,
  dayKey,
  formatHourLabel,
  formatTime,
  getSessionTone,
  initials,
  isSameDay,
  layoutDay,
  minutesOfDay,
  timeToMinutes,
} from "./schedule-utils";

const HOUR_PX = 64;
const TOP_PAD = 10;

type Props = {
  days: Date[];
  sessionsByDay: Map<string, ScheduleSession[]>;
  availability: AvailabilitySlot[];
  hourRange: [number, number];
  now: number;
  selectedDay: Date;
  selectedSessionId: string | null;
  onSelectDay: (d: Date) => void;
  onSelectSession: (s: ScheduleSession) => void;
};

export function WeekGrid({
  days,
  sessionsByDay,
  availability,
  hourRange,
  now,
  selectedDay,
  selectedSessionId,
  onSelectDay,
  onSelectSession,
}: Props) {
  const [fromHour, toHour] = hourRange;
  const hours = useMemo(() => Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i), [fromHour, toHour]);
  const bodyHeight = (toHour - fromHour) * HOUR_PX + TOP_PAD * 2;
  const nowDate = new Date(now);
  const scrollRef = useRef<HTMLDivElement>(null);

  const yFor = (minutes: number) => TOP_PAD + ((minutes - fromHour * 60) / 60) * HOUR_PX;

  // On week change, bring the current time (this week) or the first class into view.
  const weekKey = dayKey(days[0]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let target: number | null = null;
    if (days.some((d) => isSameDay(d, new Date()))) {
      target = minutesOfDay(new Date());
    } else {
      const firsts = days
        .map((d) => sessionsByDay.get(dayKey(d))?.[0])
        .filter((s): s is ScheduleSession => !!s)
        .map((s) => minutesOfDay(new Date(s.scheduledStart)));
      if (firsts.length) target = Math.min(...firsts);
    }
    el.scrollTop = target === null ? 0 : Math.max(0, yFor(target) - HOUR_PX * 1.5);
    // Only re-run when the visible week changes, not on every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey, fromHour]);

  const gridCols = "grid-cols-[56px_repeat(7,minmax(0,1fr))]";

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Day headers */}
        <div className={cn("grid border-b border-border", gridCols)}>
          <div />
          {days.map((d) => {
            const isToday = isSameDay(d, nowDate);
            const isSelected = isSameDay(d, selectedDay);
            const list = sessionsByDay.get(dayKey(d)) ?? [];
            const count = list.filter((s) => getSessionTone(s, now) !== "cancelled").length;
            return (
              <button
                key={dayKey(d)}
                type="button"
                onClick={() => onSelectDay(d)}
                aria-pressed={isSelected}
                className={cn(
                  "group flex flex-col items-center gap-1 py-3 transition-colors focus-ring rounded-t-xl",
                  isSelected ? "bg-brand/[0.06]" : "hover:bg-surface-inset/60"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.08em]",
                    isToday ? "text-brand" : "text-text-subtle"
                  )}
                >
                  {DAY_SHORT[d.getDay()]}
                </span>
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full font-display text-[18px] font-bold leading-none transition-colors",
                    isToday
                      ? "bg-brand text-brand-on shadow-sm"
                      : isSelected
                        ? "bg-surface text-text ring-1 ring-brand/30"
                        : "text-text group-hover:bg-surface"
                  )}
                >
                  {d.getDate()}
                </span>
                <span className={cn("h-4 text-[11px] font-medium", count ? "text-text-muted" : "text-transparent")}>
                  {count ? `${count} class${count !== 1 ? "es" : ""}` : "·"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Time grid */}
        <div ref={scrollRef} className="relative max-h-[620px] overflow-y-auto">
          <div className={cn("grid", gridCols)} style={{ height: bodyHeight }}>
            {/* Hour gutter */}
            <div className="relative">
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute right-3 -translate-y-1/2 text-[11px] font-medium text-text-subtle tabular-nums"
                  style={{ top: yFor(h * 60) }}
                >
                  {formatHourLabel(h)}
                </span>
              ))}
            </div>

            {days.map((d) => {
              const key = dayKey(d);
              const isToday = isSameDay(d, nowDate);
              const isSelected = isSameDay(d, selectedDay);
              const dayStart = new Date(d);
              const isPastDay = dayStart.getTime() + 24 * 3600_000 <= now;
              const slots = availability.filter((a) => a.dayOfWeek === d.getDay());
              const positioned = layoutDay(sessionsByDay.get(key) ?? []);
              const nowY = isToday ? yFor(minutesOfDay(nowDate)) : null;

              return (
                <div
                  key={key}
                  className={cn("relative border-l border-border", isSelected && "bg-brand/[0.03]")}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_PX}px)`,
                    backgroundPositionY: TOP_PAD,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: `100% ${(toHour - fromHour) * HOUR_PX + 1}px`,
                  }}
                >
                  {/* Working hours */}
                  {slots.map((a, i) => {
                    const top = yFor(timeToMinutes(a.startTime));
                    const bottom = yFor(timeToMinutes(a.endTime));
                    return (
                      <div
                        key={i}
                        className="absolute inset-x-0 bg-trust/[0.07] border-l-2 border-trust/30"
                        style={{ top, height: Math.max(0, bottom - top) }}
                        aria-hidden
                      />
                    );
                  })}

                  {/* Time that has already passed */}
                  {(isPastDay || nowY !== null) && (
                    <div
                      className="absolute inset-x-0 top-0 bg-surface-inset/50 pointer-events-none"
                      style={{ height: isPastDay ? bodyHeight : Math.max(0, nowY!) }}
                      aria-hidden
                    />
                  )}

                  {/* Classes */}
                  {positioned.map(({ session, lane, lanes }) => {
                    const start = new Date(session.scheduledStart);
                    const end = new Date(session.scheduledEnd);
                    const startMin = minutesOfDay(start);
                    const endMin = isSameDay(start, end) ? minutesOfDay(end) : 24 * 60;
                    const top = yFor(startMin);
                    const height = Math.max(24, yFor(endMin) - top - 2);
                    const tone = getSessionTone(session, now);
                    const styles = TONE_STYLES[tone];
                    const compact = height < 44;
                    const isActive = session.id === selectedSessionId;
                    // Side-by-side blocks are too narrow for names; initials beat "No…".
                    const label = lanes > 1 ? initials(session.student.name) : session.student.name;
                    const fullLabel = `${session.student.name}, ${formatTime(start)} – ${formatTime(end)}, ${TONE_LABEL[tone]}`;

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => onSelectSession(session)}
                        title={fullLabel}
                        aria-label={fullLabel}
                        className={cn(
                          "absolute z-10 flex overflow-hidden rounded-lg border text-left transition-all duration-150 focus-ring",
                          styles.block,
                          isActive && "ring-2 ring-brand ring-offset-1 ring-offset-surface z-20 shadow-md"
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                        }}
                      >
                        <span className={cn("w-1 shrink-0", styles.bar)} aria-hidden />
                        <span
                          className={cn(
                            "min-w-0 flex-1",
                            lanes > 1 ? "px-1.5" : "px-2",
                            compact ? "flex items-center gap-1.5" : "py-1.5"
                          )}
                        >
                          <span
                            className={cn(
                              "flex items-center gap-1.5 truncate text-[12px] font-semibold leading-tight text-text",
                              tone === "cancelled" && "line-through text-text-subtle",
                              (tone === "completed" || tone === "ended") && "text-text-muted"
                            )}
                          >
                            {tone === "live" && (
                              <span className="relative flex h-2 w-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-60" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-trust" />
                              </span>
                            )}
                            <span className="truncate">{label}</span>
                          </span>
                          {!(compact && lanes > 1) && (
                            <span
                              className={cn(
                                "block truncate text-[11px] font-medium tabular-nums text-text-muted",
                                !compact && "mt-0.5"
                              )}
                            >
                              {formatTime(start)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}

                  {/* Current time — kept behind the class blocks so it never strikes through a name */}
                  {nowY !== null && nowY >= 0 && nowY <= bodyHeight && (
                    <div className="pointer-events-none absolute inset-x-0 z-[5]" style={{ top: nowY }} aria-hidden>
                      <div className="relative h-0.5 bg-alert">
                        <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-alert ring-2 ring-surface" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { CalendarX2, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SessionRow } from "./SessionRow";
import { type ScheduleSession, DAY_NAMES, dayKey, isSameDay } from "./schedule-utils";

type Props = {
  days: Date[];
  sessionsByDay: Map<string, ScheduleSession[]>;
  now: number;
  selectedSessionId: string | null;
};

export function ListView({ days, sessionsByDay, now, selectedSessionId }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const today = new Date(now);

  const groups = days.map((d) => {
    const all = sessionsByDay.get(dayKey(d)) ?? [];
    return { date: d, sessions: q ? all.filter((s) => s.student.name.toLowerCase().includes(q)) : all };
  });
  const total = groups.reduce((n, g) => n + g.sessions.length, 0);

  return (
    <div className="p-4 sm:p-5">
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
        <input
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this week by student name…"
          aria-label="Search classes by student name"
          className="h-10 w-full rounded-xl border border-border bg-surface-inset/60 pl-10 pr-9 text-[13px] text-text placeholder:text-text-subtle outline-none transition-colors focus:border-brand/40 focus:bg-surface"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-subtle hover:bg-surface-inset hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <CalendarX2 className="h-7 w-7 text-text-subtle" />
          <p className="text-[14px] font-semibold text-text">{q ? `No classes with “${query.trim()}”` : "No classes this week"}</p>
          <p className="text-[13px] text-text-muted">
            {q ? "Try a different name." : "Booked classes will show up here."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ date, sessions }) => {
            if (q && sessions.length === 0) return null;
            const isToday = isSameDay(date, today);
            return (
              <section key={dayKey(date)} aria-label={DAY_NAMES[date.getDay()]}>
                <div className="mb-2.5 flex items-baseline gap-2">
                  <h3 className={cn("text-[13px] font-bold", isToday ? "text-brand" : "text-text")}>
                    {isToday ? "Today" : DAY_NAMES[date.getDay()]}
                  </h3>
                  <span className="text-[12px] text-text-subtle">
                    {date.toLocaleDateString("en-US", { day: "numeric", month: "long" })}
                  </span>
                  {sessions.length > 0 && (
                    <span className="ml-auto text-[12px] font-medium text-text-muted">
                      {sessions.length} class{sessions.length !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
                {sessions.length === 0 ? (
                  <p className="rounded-xl bg-surface-inset/50 px-4 py-2.5 text-[12px] text-text-subtle">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <SessionRow key={s.id} session={s} now={now} highlighted={s.id === selectedSessionId} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

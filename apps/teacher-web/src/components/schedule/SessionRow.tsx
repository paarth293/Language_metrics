"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  type ScheduleSession,
  TONE_LABEL,
  TONE_STYLES,
  formatDuration,
  formatTime,
  getSessionTone,
  initials,
  sessionMinutes,
} from "./schedule-utils";

type Props = {
  session: ScheduleSession;
  now: number;
  highlighted?: boolean;
  compact?: boolean;
};

export const SessionRow = forwardRef<HTMLDivElement, Props>(function SessionRow(
  { session, now, highlighted, compact },
  ref
) {
  const start = new Date(session.scheduledStart);
  const tone = getSessionTone(session, now);
  const styles = TONE_STYLES[tone];
  const joinable = tone === "live" || tone === "open";
  const muted = tone === "completed" || tone === "ended" || tone === "cancelled";

  return (
    <div
      ref={ref}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl border bg-surface transition-all duration-150 sm:gap-3",
        compact ? "p-2.5" : "p-3 sm:px-4",
        highlighted ? "border-brand/40 ring-2 ring-brand/20 shadow-sm" : "border-border hover:border-border-strong",
        joinable && !highlighted && "border-action/40"
      )}
    >
      {/* Time */}
      <div className={cn("shrink-0 text-right tabular-nums", compact ? "w-[62px]" : "w-[56px] sm:w-[72px]")}>
        <div className={cn("text-[13px] font-bold", muted ? "text-text-muted" : "text-text")}>{formatTime(start)}</div>
        <div className="text-[11px] font-medium text-text-subtle">{formatDuration(sessionMinutes(session))}</div>
      </div>

      <span className={cn("w-1 self-stretch rounded-full", styles.bar)} aria-hidden />

      <Avatar
        src={session.student.avatarUrl || undefined}
        alt={session.student.name}
        initials={initials(session.student.name)}
        size={compact ? "sm" : "md"}
        className="shrink-0"
      />

      {/* Student */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[14px] font-semibold",
            tone === "cancelled" ? "text-text-subtle line-through" : muted ? "text-text-muted" : "text-text"
          )}
        >
          {session.student.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-muted">
          <span className="rounded-md bg-surface-inset px-1.5 py-px text-[10px] font-bold tracking-wide text-text-secondary">
            {session.student.proficiencyLevel}
          </span>
          {/* Narrow rows show status here instead of in a right-hand pill. */}
          <span
            className={cn(
              "truncate rounded-full px-1.5 py-px text-[10px] font-semibold",
              styles.pill,
              !compact && "sm:hidden",
              joinable && "hidden"
            )}
          >
            {TONE_LABEL[tone]}
          </span>
          {!compact && (
            <span className="hidden truncate capitalize sm:inline">{session.booking.type.toLowerCase()} class</span>
          )}
        </div>
      </div>

      {/* Status / action */}
      {joinable ? (
        <Button asChild variant="primary" size="sm" className="h-8 shrink-0 px-3 text-[12px]">
          <Link href={`/live/${session.id}`}>
            <Video className="mr-1.5 h-3.5 w-3.5" />
            {tone === "live" ? "Rejoin" : "Join"}
          </Link>
        </Button>
      ) : (
        !compact && (
          <span className={cn("hidden shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex", styles.pill)}>
            {TONE_LABEL[tone]}
          </span>
        )
      )}
    </div>
  );
});

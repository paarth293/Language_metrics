"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fetchWithRefresh } from "@/lib/fetch-with-refresh";
import { type ScheduleSession, formatRelativeStart } from "./schedule-utils";

/**
 * Call off one class, behind a confirm step.
 *
 * Cancelling is not undoable from here: the class is gone, the student's coin
 * hold is released and the student has been notified. So the button opens a
 * dialog that spells out all three, and nothing is sent until the teacher says
 * yes to it.
 *
 * The teacher is deliberately not held to the student's 4-hour window — a
 * teacher who cannot teach cannot teach — so this stays available right up to
 * the start of the class. It disappears once the class has started or ended,
 * because by then cancelling is the wrong tool: an abandoned class is
 * settled by `@repo/live-classes`, which has its own no-show rules.
 *
 * `onCancelled` is how the schedule finds out; this component does not reload
 * anything itself.
 */

type Props = {
  session: ScheduleSession;
  /** The schedule's ticking clock, so this re-reads nothing during render. */
  now: number;
  /** Called once the server has confirmed the cancel. */
  onCancelled: () => void;
  compact?: boolean;
};

const GENERIC_FAILURE = "Could not cancel this class. Please try again.";

export function CancelClassButton({ session, now, onCancelled, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `cancel-class-title-${session.id}`;

  const close = useCallback(() => {
    if (busy) return; // a request is in flight; let it finish
    setError(null);
    setOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const confirm = async () => {
    if (busy) return; // the guard behind the disabled attribute
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithRefresh(`/api/teachers/sessions/${session.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The server's own wording, which knows why it refused. Anything
        // unexpected falls back to something a teacher can act on.
        setError(typeof data?.error === "string" ? data.error : GENERIC_FAILURE);
        return;
      }
      setOpen(false);
      onCancelled();
    } catch {
      // A thrown Error here is a network or parsing problem; its message is
      // for the console, not for the teacher.
      setError(GENERIC_FAILURE);
    } finally {
      setBusy(false);
    }
  };

  // Nothing to call off: already gone, already taught, or already underway.
  const started = Date.parse(session.scheduledStart) <= now;
  if (
    started ||
    session.status === "CANCELLED" ||
    session.status === "COMPLETED" ||
    session.status === "ONGOING" ||
    session.booking.status === "CANCELLED"
  ) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("h-8 shrink-0 px-2.5 text-[12px] text-text-muted hover:text-danger", compact && "px-2")}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span className={cn(compact && "sr-only")}>Cancel class</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={close} aria-hidden />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative w-full overflow-hidden rounded-t-2xl bg-surface shadow-lg outline-none sm:max-w-[440px] sm:rounded-xl sm:border sm:border-border"
          >
            <header className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-subtle">Schedule</p>
              <h2 id={titleId} className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-text">
                Cancel this class?
              </h2>
            </header>

            <div className="space-y-3 px-5 py-5 text-[13px] sm:px-6">
              <p className="text-text">
                <span className="font-semibold">{session.student.name}</span>
                {" — "}
                {formatRelativeStart(new Date(session.scheduledStart), now)}
              </p>
              <p className="text-text-muted">
                Any coins held for this class go back to {session.student.name}, and they will be
                notified that you cancelled. This cannot be undone.
              </p>

              {error && (
                <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
                  {error}
                </p>
              )}
            </div>

            <footer className="flex gap-2 border-t border-border px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={busy} className="flex-1">
                Keep class
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={confirm}
                disabled={busy}
                className="flex-1"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Yes, cancel it
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, Clock, Copy, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import {
  type AvailabilitySlot,
  DAY_NAMES,
  WEEK_ORDER,
  formatClock,
  formatDuration,
  timeToMinutes,
} from "./schedule-utils";

type DraftSlot = AvailabilitySlot & { uid: number };

type Props = {
  open: boolean;
  availability: AvailabilitySlot[];
  onClose: () => void;
  onSaved: (slots: AvailabilitySlot[]) => void;
};

const WEEKDAYS = [1, 2, 3, 4, 5];
// Day · editable hours (fixed, so every row's timeline lines up) · timeline.
const ROW_COLS = "lg:grid-cols-[168px_510px_minmax(120px,1fr)]";
let nextUid = 1;
const toDraft = (slots: AvailabilitySlot[]): DraftSlot[] => slots.map((s) => ({ ...s, uid: nextUid++ }));
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const span = (s: AvailabilitySlot) => Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime));
const signature = (slots: AvailabilitySlot[]) =>
  slots
    .map((s) => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`)
    .sort()
    .join("|");

function dayError(slots: DraftSlot[]): string | null {
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  if (sorted.some((s) => timeToMinutes(s.endTime) <= timeToMinutes(s.startTime))) return "End time must be after the start time.";
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].startTime) < timeToMinutes(sorted[i - 1].endTime)) return "These time ranges overlap.";
  }
  return null;
}

const PRESETS: Array<{ label: string; hint: string; build: () => AvailabilitySlot[] }> = [
  {
    label: "Weekdays",
    hint: "Mon–Fri · 9 AM–5 PM",
    build: () => WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })),
  },
  {
    label: "Every day",
    hint: "Mon–Sun · 9 AM–5 PM",
    build: () => WEEK_ORDER.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })),
  },
  {
    label: "Evenings",
    hint: "Mon–Fri · 6–10 PM",
    build: () => WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "18:00", endTime: "22:00" })),
  },
];

/** 24h track with the day's ranges shaded — a glanceable picture of the day. */
function DayTrack({ slots, invalid }: { slots: DraftSlot[]; invalid: boolean }) {
  return (
    <div className="w-full" aria-hidden>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-inset ring-1 ring-inset ring-border">
        {[6, 12, 18].map((h) => (
          <span key={h} className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {slots.map((s) => {
          const start = timeToMinutes(s.startTime);
          const end = timeToMinutes(s.endTime);
          if (end <= start) return null;
          return (
            <span
              key={s.uid}
              className={cn("absolute inset-y-0 rounded-full", invalid ? "bg-alert/60" : "bg-trust")}
              style={{ left: `${(start / 1440) * 100}%`, width: `${((end - start) / 1440) * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function CopyMenu({ onCopy }: { onCopy: (targets: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const pick = (targets: number[]) => {
    onCopy(targets);
    setOpen(false);
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-text-muted transition-colors hover:bg-surface-inset hover:text-text focus-ring"
      >
        <Copy className="h-3.5 w-3.5" /> Copy <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
          <button type="button" role="menuitem" onClick={() => pick(WEEKDAYS)} className="block w-full px-3 py-2 text-left text-[12px] text-text hover:bg-surface-inset">
            Copy to weekdays
          </button>
          <button type="button" role="menuitem" onClick={() => pick(WEEK_ORDER)} className="block w-full px-3 py-2 text-left text-[12px] text-text hover:bg-surface-inset">
            Copy to every day
          </button>
        </div>
      )}
    </div>
  );
}

export function AvailabilityEditor({ open, availability, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<DraftSlot[]>(() => toDraft(availability));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Start every opening from the saved state.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(toDraft(availability));
      setError(null);
      setConfirmDiscard(false);
      setFlash(null);
    }
  }

  const dirty = signature(draft) !== signature(availability);
  const slotsFor = (day: number) =>
    draft.filter((s) => s.dayOfWeek === day).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const errors = new Map(WEEK_ORDER.map((d) => [d, dayError(slotsFor(d))]));
  const errorCount = [...errors.values()].filter(Boolean).length;
  const totalMinutes = draft.reduce((n, s) => n + span(s), 0);
  const daysOn = WEEK_ORDER.filter((d) => slotsFor(d).length > 0).length;

  const requestClose = () => {
    if (dirty && !saving) setConfirmDiscard(true);
    else onClose();
  };

  // Esc must see the latest draft (to ask before discarding), without
  // re-running the open/close effect on every keystroke.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestCloseRef.current();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash((f) => (f === msg ? null : f)), 1800);
  };

  const update = (uid: number, patch: Partial<AvailabilitySlot>) =>
    setDraft((d) => d.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const remove = (uid: number) => setDraft((d) => d.filter((s) => s.uid !== uid));
  const add = (day: number) => {
    const existing = slotsFor(day);
    const last = existing[existing.length - 1];
    // A follow-on range starts an hour after the previous one ends.
    const startMin = last ? Math.min(timeToMinutes(last.endTime) + 60, 22 * 60) : 9 * 60;
    const endMin = Math.min(startMin + (last ? 120 : 8 * 60), 23 * 60 + 59);
    setDraft((d) => [...d, { dayOfWeek: day, startTime: fmt(startMin), endTime: fmt(endMin), uid: nextUid++ }]);
  };
  const toggleDay = (day: number) => {
    if (slotsFor(day).length) setDraft((d) => d.filter((s) => s.dayOfWeek !== day));
    else add(day);
  };
  const copyDay = (from: number, targets: number[]) => {
    const source = slotsFor(from);
    setDraft((d) => [
      ...d.filter((s) => !targets.includes(s.dayOfWeek) || s.dayOfWeek === from),
      ...targets
        .filter((t) => t !== from)
        .flatMap((t) => source.map((s) => ({ dayOfWeek: t, startTime: s.startTime, endTime: s.endTime, uid: nextUid++ }))),
    ]);
    showFlash(`Copied ${DAY_NAMES[from]}'s hours to ${targets.length === 7 ? "every day" : "weekdays"}`);
  };
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setDraft(toDraft(preset.build()));
    showFlash(`Applied "${preset.label}"`);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = draft.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
    try {
      const res = await fetch("/api/teachers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ availability: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onSaved(payload);
    } catch {
      setError("Couldn't save your working hours. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-stretch justify-center transition-opacity duration-200 sm:items-center sm:p-6",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      inert={!open}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={requestClose} aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hours-title"
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-surface shadow-lg outline-none transition-transform duration-200 sm:max-h-[min(88vh,860px)] sm:max-w-[920px] sm:rounded-xl sm:border sm:border-border",
          open ? "translate-y-0 sm:scale-100" : "translate-y-4 sm:scale-[0.98]"
        )}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-subtle">Working hours</p>
            <h2 id="hours-title" className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-text">
              When can students book you?
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-muted">
              Classes can only be booked inside these hours.
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-0.5 text-[11px] font-medium text-text-muted">
                <Clock className="h-3 w-3" /> {timeZone}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-inset hover:text-text focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-inset/40 px-5 py-3 sm:px-6">
          <span className="mr-1 text-[11px] font-semibold text-text-subtle">Quick start</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 focus-ring"
            >
              <span className="text-[12px] font-semibold text-text">{p.label}</span>
              <span className="hidden text-[11px] text-text-subtle md:inline">{p.hint}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDraft([]);
              showFlash("Cleared all days");
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-alert/10 hover:text-alert focus-ring"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        </div>

        {/* Days */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6">
          <div
            className={cn(
              "sticky top-0 z-[1] hidden border-b border-border bg-surface py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-subtle lg:grid lg:gap-5",
              ROW_COLS
            )}
            aria-hidden
          >
            <span>Day</span>
            <span>Hours</span>
            <span className="flex justify-between font-medium normal-case tracking-normal tabular-nums">
              <span>12a</span>
              <span>6a</span>
              <span>12p</span>
              <span>6p</span>
              <span>12a</span>
            </span>
          </div>
        <ul className="divide-y divide-border">
          {WEEK_ORDER.map((day) => {
            const slots = slotsFor(day);
            const on = slots.length > 0;
            const err = errors.get(day);
            const minutes = slots.reduce((n, s) => n + span(s), 0);
            return (
              <li key={day} className={cn("grid grid-cols-1 gap-3 py-3.5 lg:items-center lg:gap-5", ROW_COLS)}>
                {/* Day + switch */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`Available on ${DAY_NAMES[day]}`}
                    onClick={() => toggleDay(day)}
                    className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring", on ? "bg-trust" : "bg-border-strong")}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                        on ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                  <div className="min-w-0">
                    <p className={cn("text-[14px] font-semibold", on ? "text-text" : "text-text-subtle")}>{DAY_NAMES[day]}</p>
                    <p className={cn("text-[11px] tabular-nums", err ? "font-medium text-alert" : "text-text-subtle")}>
                      {!on ? "Unavailable" : err ? "Check times" : formatDuration(minutes)}
                    </p>
                  </div>
                </div>

                {/* Ranges */}
                <div className="min-w-0">
                  {on ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {slots.map((s) => (
                        <div key={s.uid} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={s.startTime}
                            onChange={(e) => update(s.uid, { startTime: e.target.value })}
                            aria-label={`${DAY_NAMES[day]} start time`}
                            className={cn(
                              "h-9 w-[128px] rounded-lg border bg-surface-inset/60 px-2.5 text-[13px] tabular-nums text-text outline-none transition-colors focus:border-brand/50 focus:bg-surface",
                              err ? "border-alert/50" : "border-border"
                            )}
                          />
                          <span className="text-[12px] text-text-subtle">–</span>
                          <input
                            type="time"
                            value={s.endTime}
                            onChange={(e) => update(s.uid, { endTime: e.target.value })}
                            aria-label={`${DAY_NAMES[day]} end time`}
                            className={cn(
                              "h-9 w-[128px] rounded-lg border bg-surface-inset/60 px-2.5 text-[13px] tabular-nums text-text outline-none transition-colors focus:border-brand/50 focus:bg-surface",
                              err ? "border-alert/50" : "border-border"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => remove(s.uid)}
                            aria-label={`Remove ${formatClock(s.startTime)} to ${formatClock(s.endTime)}`}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-alert/10 hover:text-alert focus-ring"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => add(day)}
                          aria-label={`Add more hours on ${DAY_NAMES[day]}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-brand transition-colors hover:bg-brand/10 focus-ring"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                        {!err && <CopyMenu onCopy={(targets) => copyDay(day, targets)} />}
                      </div>
                      </div>
                      {err && (
                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-alert">
                          <AlertCircle className="h-3.5 w-3.5" /> {err}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(day)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-[12px] font-medium text-text-muted transition-colors hover:border-brand/40 hover:text-brand focus-ring md:mt-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add hours
                    </button>
                  )}
                </div>

                {/* Picture of the day */}
                <div className="hidden lg:block">
                  <DayTrack slots={slots} invalid={!!err} />
                </div>
              </li>
            );
          })}
        </ul>
        </div>

        {/* Footer */}
        <footer className="border-t border-border bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {confirmDiscard ? (
            <div className="flex flex-wrap items-center gap-3 py-1" role="alert">
              <p className="mr-auto text-[13px] font-semibold text-text">Discard your unsaved changes?</p>
              <Button variant="outline" size="sm" onClick={() => setConfirmDiscard(false)}>
                Keep editing
              </Button>
              <Button variant="danger" size="sm" onClick={onClose}>
                Discard
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 py-1">
              <div className="mr-auto min-w-0 text-[12px] text-text-muted">
                {error ? (
                  <span className="flex items-center gap-1.5 font-medium text-alert">
                    <AlertCircle className="h-4 w-4" /> {error}
                  </span>
                ) : flash ? (
                  <span className="flex items-center gap-1.5 font-medium text-trust" role="status">
                    <Check className="h-4 w-4" /> {flash}
                  </span>
                ) : errorCount ? (
                  <span className="flex items-center gap-1.5 font-medium text-alert">
                    <AlertCircle className="h-4 w-4" /> Fix {errorCount} day{errorCount === 1 ? "" : "s"} to save
                  </span>
                ) : (
                  <span>
                    <span className="font-bold text-text">{daysOn}</span> day{daysOn === 1 ? "" : "s"} ·{" "}
                    <span className="font-bold text-text">{totalMinutes ? formatDuration(totalMinutes) : "0h"}</span> per week
                    {dirty && <span className="ml-2 rounded-full bg-action/15 px-2 py-0.5 text-[10px] font-bold text-gold-strong">Unsaved</span>}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={requestClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={save} isLoading={saving} disabled={!dirty || errorCount > 0}>
                Save hours
              </Button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

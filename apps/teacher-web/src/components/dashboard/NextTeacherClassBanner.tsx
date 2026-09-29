"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { canJoin, getJoinState, useNow, type JoinableSession } from "@/lib/class-join";

type ScheduleBooking = {
  id: string;
  type?: string;
  student: { name: string };
  nextSession: (JoinableSession & { id: string }) | null;
};

/**
 * The teacher's next class, surfaced on the dashboard while it is joinable or
 * about to be. Renders nothing otherwise, so a quiet day adds no clutter.
 */
export function NextTeacherClassBanner() {
  const [bookings, setBookings] = useState<ScheduleBooking[]>([]);
  const now = useNow();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teachers/schedule", { credentials: "include" });
      if (res.ok) setBookings((await res.json()).upcoming ?? []);
    } catch {
      // The banner is a convenience; the Schedule page still lists every class.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const next = bookings
    .filter((b) => b.nextSession)
    .map((b) => ({ booking: b, session: b.nextSession!, state: getJoinState(b.nextSession!, now) }))
    .filter((x) => x.state === "live" || x.state === "open" || x.state === "soon")
    .sort((a, b) => Date.parse(a.session.scheduledStart) - Date.parse(b.session.scheduledStart))[0];

  if (!next) return null;

  const { booking, session, state } = next;
  const start = new Date(session.scheduledStart);
  const end = new Date(session.scheduledEnd);
  const time = `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const joinable = canJoin(state);
  const minsToOpen = session.joinOpensAt ? Math.max(1, Math.ceil((Date.parse(session.joinOpensAt) - now) / 60_000)) : null;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm ${
        joinable ? "border-action/40 bg-action/10" : "border-border bg-surface"
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
          {state === "live" ? "Class in progress" : joinable ? "Your class is open" : "Next class"}
          {booking.type === "DEMO" ? " · Demo" : ""}
        </p>
        <p className="font-display text-lg font-bold text-text truncate mt-0.5">{booking.student.name}</p>
        <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
          <Clock className="w-3.5 h-3.5" /> {time}
        </p>
      </div>
      {joinable ? (
        <Button asChild variant="primary" className="shrink-0 shadow-sm">
          <Link href={`/live/${session.id}`}>
            <Video className="w-4 h-4 mr-2" /> {state === "live" ? "Rejoin class" : "Join class"}
          </Link>
        </Button>
      ) : (
        <span className="shrink-0 text-sm font-medium text-text-muted">
          Opens in {minsToOpen ?? "a few"} min
        </span>
      )}
    </div>
  );
}

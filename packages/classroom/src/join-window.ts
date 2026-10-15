import { useEffect, useState } from "react";

/**
 * Client-side view of a class's join window.
 *
 * The server sends `joinOpensAt`/`joinClosesAt` from the same rule that
 * decides whether a join is accepted (packages/live-classes getJoinWindow),
 * so a Join button driven by this is shown exactly when joining will work.
 */

export interface JoinableSession {
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  joinOpensAt?: string;
  joinClosesAt?: string;
}

/**
 * - live:     someone is already in the room
 * - open:     inside the join window
 * - soon:     opens within the hour
 * - upcoming: later than that
 * - closed:   window has passed, or the class is over
 */
export type JoinState = "live" | "open" | "soon" | "upcoming" | "closed";

// Fallbacks match the server defaults, for responses cached before the
// window fields existed.
const DEFAULT_EARLY_MS = 10 * 60_000;
const DEFAULT_GRACE_MS = 10 * 60_000;

export function getJoinState(session: JoinableSession, now: number): JoinState {
  if (session.status === "COMPLETED" || session.status === "CANCELLED") return "closed";

  const opensAt = session.joinOpensAt
    ? Date.parse(session.joinOpensAt)
    : Date.parse(session.scheduledStart) - DEFAULT_EARLY_MS;
  const closesAt = session.joinClosesAt
    ? Date.parse(session.joinClosesAt)
    : Date.parse(session.scheduledEnd) + DEFAULT_GRACE_MS;

  if (now > closesAt) return "closed";
  if (session.status === "ONGOING") return "live";
  if (now >= opensAt) return "open";
  if (opensAt - now <= 60 * 60_000) return "soon";
  return "upcoming";
}

export function canJoin(state: JoinState): boolean {
  return state === "live" || state === "open";
}

/** Current time that re-renders the caller every `intervalMs`, so Join buttons appear on time. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

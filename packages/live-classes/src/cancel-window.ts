/**
 * When a student may cancel a class.
 *
 * One rule, in one file, for every student cancel path. Both web apps carry
 * their own copy of the student cancel route, and before this module each copy
 * wrote the window out as its own number — once as a named constant, once as an
 * inline `12 * 60 * 60 * 1000`. Two copies of a policy is one copy too many, so
 * the routes, the list responses and the buttons all read it from here.
 *
 * ── Time ───────────────────────────────────────────────────────────────────
 *
 * `ClassSession.scheduledStart` is an absolute instant, not a wall-clock time,
 * and Prisma hands it back as a `Date`. Every comparison here is therefore an
 * absolute-time comparison, which is UTC-correct for free: no zone conversion
 * is needed and none is done. There is deliberately no way to pass a
 * client-supplied clock into a server decision — `now` defaults to the server's
 * time and the routes never override it.
 *
 * This module imports nothing. It is safe to pull into a client component.
 */

/** How long before the start of a class student cancellation closes. */
export const STUDENT_CANCEL_WINDOW_HOURS = 4;

/** The same window in milliseconds, for comparing two instants. */
export const STUDENT_CANCEL_WINDOW_MS = STUDENT_CANCEL_WINDOW_HOURS * 60 * 60 * 1000;

/** Machine-readable reason on a refusal, so a client need not match on prose. */
export const STUDENT_CANCEL_REFUSAL_CODE = "CANCEL_WINDOW_CLOSED";

/** The one sentence shown next to a cancel button. */
export const STUDENT_CANCEL_WINDOW_NOTE =
  `Cancellation closes ${STUDENT_CANCEL_WINDOW_HOURS} hours before the class.`;

/** What a refused cancel says. */
export function studentCancelRefusalMessage(): string {
  return (
    `This class starts in less than ${STUDENT_CANCEL_WINDOW_HOURS} hours, so it can no longer ` +
    `be cancelled. Please contact support if you cannot attend.`
  );
}

/**
 * The last instant at which a student may cancel a class starting at `startAt`.
 *
 * Sent to clients so a button is enabled exactly when a cancel will be
 * accepted, rather than each UI deriving the boundary itself — the same shape
 * the join window already uses (`joinOpensAt` / `joinClosesAt`).
 */
export function studentCancelClosesAt(startAt: Date): Date {
  return new Date(startAt.getTime() - STUDENT_CANCEL_WINDOW_MS);
}

/**
 * May a student cancel a class starting at `startAt`?
 *
 * Allowed when the class is at least `STUDENT_CANCEL_WINDOW_HOURS` away.
 * Exactly on the boundary is allowed; one millisecond inside it is not. A class
 * that has already started, or an unusable date, is refused — this fails closed.
 */
export function canStudentCancel(startAt: Date, now: Date = new Date()): boolean {
  const start = startAt.getTime();
  const current = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(current)) return false;
  return start - current >= STUDENT_CANCEL_WINDOW_MS;
}

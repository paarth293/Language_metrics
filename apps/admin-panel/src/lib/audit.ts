import { db } from "@repo/database";

// Every privileged action is recorded. The AdminAuditLog model is append-only
// and referenced to the acting admin's User row for non-repudiation.

export interface AuditContext {
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * KNOWN SCHEMA MISMATCH (errors.md #N7 — flagged, not silently patched here
 * because fixing it properly needs a Prisma migration this environment
 * can't run/verify):
 *
 * AdminAuditLog.actorId is documented in schema.prisma as "User UUID when
 * known; attempted username on failed login" — i.e. it's meant to identify
 * a PERSON. Every call site below instead passes whatever record the action
 * was performed ON (a teacher's userId, a payout's own id, or — for
 * login/logout — the acting admin's own id again). For teacher
 * approve/suspend actions that happens to still be a user id, so it reads
 * fine; for payouts it is a Payout.id, which is not a user at all. Anyone
 * querying `actorId` expecting a person (per the schema's own doc comment)
 * will get a mix of user ids and unrelated record ids.
 *
 * This function still writes to `actorId` as before (changing the mapping
 * without a migration would just move the inconsistency rather than fix
 * it), but the parameter is named for what it actually is — the subject/
 * target record of the action — and callers are encouraged to also pass the
 * record type in `details` (as the payouts/teachers routes already do)
 * until AdminAuditLog gets a proper `targetType`/`targetId` pair alongside
 * `actorId` in a future migration.
 */
export async function auditLog(
  ctx: AuditContext,
  action: string,
  subjectId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: ctx.adminId,
        eventType: action,
        actorId: subjectId ?? "",
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        outcome: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    // Audit must never break the primary operation, but failures are surfaced.
    console.error("audit log write failed:", err);
  }
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  result: "SUCCESS" | "FAILED" | "RATE_LIMITED" | "LOCKED",
  adminUserId: string | null
): Promise<void> {
  try {
    await db.loginAttempt.create({
      data: { email, ip, result, adminUserId },
    });
  } catch (err) {
    console.error("login attempt write failed:", err);
  }
}

export async function recordSecurityEvent(
  type: string,
  severity: "INFO" | "WARN" | "CRITICAL",
  details: Record<string, unknown>,
  actorUserId: string | null,
  ip: string | null
): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        type,
        severity,
        details: JSON.stringify(details),
        actorUserId,
        ip,
      },
    });
  } catch (err) {
    console.error("security event write failed:", err);
  }
}

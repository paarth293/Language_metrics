import { db } from "@repo/database";

// Every privileged action is recorded. The AdminAuditLog model is append-only
// and referenced to the acting admin's User row for non-repudiation.

export interface AuditContext {
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function auditLog(
  ctx: AuditContext,
  action: string,
  targetId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: ctx.adminId,
        eventType: action,
        actorId: targetId ?? "",
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

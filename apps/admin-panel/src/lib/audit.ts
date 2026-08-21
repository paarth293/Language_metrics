import { db } from "@repo/database";

export type AuditEventType = "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT";

export async function writeAuditLog(input: {
  eventType: AuditEventType;
  actorId?: string | null;
  adminId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  outcome: "success" | "failure";
}): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        eventType: input.eventType,
        actorId: input.actorId ?? undefined,
        adminId: input.adminId ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
        outcome: input.outcome,
      },
    });
  } catch (err) {
    // Never fail the auth flow because audit write failed — log server-side.
    console.error("[audit] failed to write AdminAuditLog", err);
  }
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

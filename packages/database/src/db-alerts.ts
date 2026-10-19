import { log } from "@repo/logger";
import { reportOpsAlert } from "@repo/logger/ops-alert";

/**
 * Prisma error messages that mean the database itself is failing (#8e):
 * unreachable, timed out, pool exhausted or out of connection slots. One bad
 * query (a unique violation, a missing row) is not an outage.
 */
const DATABASE_DOWN = /\bP10(?:01|02|08|17)\b|\bP2024\b|can't reach database server|timed out fetching a new connection|server has closed the connection|too many (?:connections|clients)|remaining connection slots|connection (?:terminated|refused|reset)|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i;

/** Prisma's `error` log event: log it as JSON, and alert when the database is down. */
export function onPrismaError(event: { message: string; target?: string }): void {
  log.error("[prisma]", { message: event.message, target: event.target });
  if (!DATABASE_DOWN.test(event.message)) return;
  // A log listener cannot be awaited; delivery is best-effort (reportOpsAlert never throws).
  void reportOpsAlert("db_error", { scope: "prisma", reason: "The database is failing.", message: event.message });
}

/**
 * Ops alerts (#8e): tell a human when a cron fails, payment routes keep
 * answering 5xx, or the database or Redis is failing.
 *
 * Every alert is logged. When OPS_ALERT_WEBHOOK_URL is set it is also POSTed
 * there with `text` (Slack) and `content` (Discord), like the payment
 * incident webhook. Delivery is best-effort and never throws.
 *
 * Throttling and the 5xx counter live in this instance's memory: one
 * instance sends at most one alert per kind and scope every 5 minutes, and
 * counts only the errors it served itself.
 */
import { log, redact } from "./index";

export type OpsAlertKind = "cron_failed" | "payment_5xx" | "db_error" | "redis_error";

export interface OpsAlertDetail {
  /** What failed (a cron name, a route, a client); alerts are throttled per kind and scope. */
  scope?: string;
  reason?: string;
  [detail: string]: unknown;
}

const ALERT_TIMEOUT_MS = 5_000;
const THROTTLE_MS = 5 * 60_000;

/** Last webhook delivery per kind + scope, and how many alerts were held back since. */
const sent = new Map<string, { at: number; suppressed: number }>();

export async function reportOpsAlert(kind: OpsAlertKind, detail: OpsAlertDetail = {}): Promise<void> {
  log.error("[ops-alert]", { kind, detail });
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return;

  const key = `${kind}:${detail.scope ?? ""}`;
  const now = Date.now();
  const last = sent.get(key);
  if (last && now - last.at < THROTTLE_MS) {
    last.suppressed += 1;
    return;
  }
  const suppressed = last?.suppressed ?? 0;
  sent.set(key, { at: now, suppressed: 0 });

  const text = [
    `Ops alert: ${kind}${detail.scope ? ` (${detail.scope})` : ""}.`,
    detail.reason,
    suppressed ? `${suppressed} similar alert(s) held back in the last 5 minutes.` : undefined,
  ].filter(Boolean).join(" ");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(redact({ text, content: text, kind, detail, suppressed, environment: process.env.VERCEL_ENV })),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!response.ok) log.error("ops alert delivery failed", { status: response.status });
  } catch (error) {
    log.error("ops alert delivery failed", { error });
  }
}

const SERVER_ERROR_WINDOW_MS = 5 * 60_000;
const SERVER_ERROR_THRESHOLD = 3;

/** Times of recent 5xx answers per scope (one entry per route, so it stays small). */
const serverErrors = new Map<string, number[]>();

/** Record a 5xx answer; alert once SERVER_ERROR_THRESHOLD of them land within 5 minutes. */
export async function noteServerError(scope: string, status: number): Promise<void> {
  const now = Date.now();
  const recent = (serverErrors.get(scope) ?? []).filter((at) => now - at < SERVER_ERROR_WINDOW_MS);
  recent.push(now);
  if (recent.length < SERVER_ERROR_THRESHOLD) {
    serverErrors.set(scope, recent);
    return;
  }
  serverErrors.delete(scope);
  await reportOpsAlert("payment_5xx", {
    scope,
    count: recent.length,
    lastStatus: status,
    reason: `${recent.length} server errors in 5 minutes.`,
  });
}

/** Wrap a payment route handler so its 5xx answers (and thrown errors) are counted. */
export function withServerErrorAlerts<A extends unknown[]>(
  scope: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    let response: Response;
    try {
      response = await handler(...args);
    } catch (error) {
      await noteServerError(scope, 500);
      throw error;
    }
    if (response.status >= 500) await noteServerError(scope, response.status);
    return response;
  };
}

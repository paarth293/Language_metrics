/**
 * src/sentry.ts — Sentry settings shared by the server (instrumentation.ts)
 * and the browser (instrumentation-client.ts). Sentry only starts when a DSN
 * is set, so an unconfigured deployment sends nothing anywhere (#8).
 */
import { redact, redactText } from "@repo/logger";

/** The parts of an event that can carry request data. */
interface ScrubbableRequest {
  url?: string;
  query_string?: unknown;
  cookies?: unknown;
  data?: unknown;
  headers?: Record<string, string>;
}

/** Headers that carry credentials or signatures, matched case-insensitively. */
const SECRET_HEADERS = /^(authorization|cookie|set-cookie|x-client-secret|x-client-id|x-webhook-signature|x-webhook-timestamp|x-api-key|proxy-authorization)$/i;

/**
 * Remove everything from an event that could hold a secret: cookies, request
 * bodies (passwords, OTPs, payment details), query strings (reset tokens) and
 * credential headers. What is left (path, method, other headers, the stack)
 * is enough to find the bug.
 */
export function scrubEvent<T extends { request?: ScrubbableRequest }>(event: T): T {
  const request = event.request;
  if (!request) return event;
  const scrubbed: ScrubbableRequest = { ...request };
  delete scrubbed.query_string;
  delete scrubbed.cookies;
  delete scrubbed.data;
  if (scrubbed.url) scrubbed.url = scrubbed.url.split("?")[0];
  if (scrubbed.headers) {
    scrubbed.headers = Object.fromEntries(Object.entries(scrubbed.headers).filter(([name]) => !SECRET_HEADERS.test(name)));
  }
  return { ...event, request: scrubbed };
}

/** A breadcrumb: console lines, fetch/XHR calls and navigations before the error. */
interface ScrubbableBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
}

interface ScrubbableFrame {
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  vars?: Record<string, unknown>;
}

/** The parts of an event that can carry a secret inside the error itself. */
interface ScrubbableEvent {
  request?: ScrubbableRequest;
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: { value?: string; stacktrace?: { frames?: ScrubbableFrame[] } }[] };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
}

/** Breadcrumb data fields that hold a URL, whose query string may carry a token. */
const URL_FIELDS = ["url", "to", "from"];

/**
 * Mask secrets in a breadcrumb the way @repo/logger masks log lines (JWTs,
 * bearer tokens, URL passwords, card numbers, secret-named fields), and drop
 * query strings from recorded URLs.
 */
export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(crumb: T): T {
  const scrubbed = { ...crumb };
  if (typeof scrubbed.message === "string") scrubbed.message = redactText(scrubbed.message);
  if (scrubbed.data) {
    const masked = redact(scrubbed.data) as Record<string, unknown>;
    scrubbed.data = Object.fromEntries(
      Object.entries(masked).map(([key, value]) => [
        key,
        URL_FIELDS.includes(key) && typeof value === "string" ? value.split("?")[0] : value,
      ]),
    );
  }
  return scrubbed;
}

function scrubFrame(frame: ScrubbableFrame): ScrubbableFrame {
  return {
    ...frame,
    ...(frame.context_line !== undefined ? { context_line: redactText(frame.context_line) } : {}),
    ...(frame.pre_context ? { pre_context: frame.pre_context.map(redactText) } : {}),
    ...(frame.post_context ? { post_context: frame.post_context.map(redactText) } : {}),
    ...(frame.vars ? { vars: redact(frame.vars) as Record<string, unknown> } : {}),
  };
}

/**
 * Mask secrets carried by the error itself: messages (a Prisma error names
 * the database URL), stack source lines and variables, extra, contexts and
 * breadcrumbs.
 */
export function scrubErrorDetails<T extends ScrubbableEvent>(event: T): T {
  const scrubbed = { ...event };
  if (typeof scrubbed.message === "string") scrubbed.message = redactText(scrubbed.message);
  if (scrubbed.logentry) {
    scrubbed.logentry = {
      ...scrubbed.logentry,
      ...(typeof scrubbed.logentry.message === "string" ? { message: redactText(scrubbed.logentry.message) } : {}),
      ...(scrubbed.logentry.params ? { params: redact(scrubbed.logentry.params) as unknown[] } : {}),
    };
  }
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((exception) => ({
        ...exception,
        ...(typeof exception.value === "string" ? { value: redactText(exception.value) } : {}),
        ...(exception.stacktrace?.frames
          ? { stacktrace: { ...exception.stacktrace, frames: exception.stacktrace.frames.map(scrubFrame) } }
          : {}),
      })),
    };
  }
  if (scrubbed.extra) scrubbed.extra = redact(scrubbed.extra) as Record<string, unknown>;
  if (scrubbed.contexts) scrubbed.contexts = redact(scrubbed.contexts) as Record<string, unknown>;
  if (scrubbed.breadcrumbs) scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(scrubBreadcrumb);
  return scrubbed;
}

export function sentryOptions(dsn: string) {
  return {
    dsn,
    // No IP addresses, cookies or user details unless we add them ourselves.
    sendDefaultPii: false,
    // Errors only; performance tracing costs quota and is not set up.
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    beforeSend: <T extends ScrubbableEvent>(event: T) => scrubErrorDetails(scrubEvent(event)),
    beforeBreadcrumb: <T extends ScrubbableBreadcrumb>(crumb: T) => scrubBreadcrumb(crumb),
  };
}

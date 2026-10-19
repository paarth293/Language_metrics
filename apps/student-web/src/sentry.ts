/**
 * src/sentry.ts — Sentry settings shared by the server (instrumentation.ts)
 * and the browser (instrumentation-client.ts). Sentry only starts when a DSN
 * is set, so an unconfigured deployment sends nothing anywhere (#8).
 */

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

export function sentryOptions(dsn: string) {
  return {
    dsn,
    // No IP addresses, cookies or user details unless we add them ourselves.
    sendDefaultPii: false,
    // Errors only; performance tracing costs quota and is not set up.
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    beforeSend: <T extends { request?: ScrubbableRequest }>(event: T) => scrubEvent(event),
  };
}

/**
 * Next.js calls register() once when a server instance starts. A bad
 * environment fails the boot here instead of on the first request (#31), and
 * Sentry starts here when SENTRY_DSN is set (#8).
 */
import type { Instrumentation } from "next";
import { log } from "@repo/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOnBoot } = await import("./env");
    validateEnvOnBoot();

    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      const [Sentry, { sentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("./sentry")]);
      Sentry.init(sentryOptions(dsn));
    }
  }
}

/** Errors thrown by route handlers, pages and server actions. */
export const onRequestError: Instrumentation.onRequestError = async (error, errorRequest, errorContext) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  log.error("[request-error]", {
    digest,
    path: errorRequest.path,
    method: errorRequest.method,
    routePath: errorContext.routePath,
    error,
  });

  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, errorRequest, errorContext);
};

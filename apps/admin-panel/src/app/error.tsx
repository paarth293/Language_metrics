"use client";

/**
 * Error page for everything under the root layout (#8f). admin-panel had
 * none, so a thrown page showed Next's bare default. The error text stays
 * out of the page; the digest lets support find the server log line.
 */
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // An error boundary swallows the error, so Sentry only hears of it here.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <div
      role="alert"
      style={{ backgroundColor: "var(--lm-bg)" }}
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="max-w-md w-full flex flex-col items-center space-y-3">
        <div
          style={{ backgroundColor: "var(--lm-surface2)", color: "var(--lm-accent)" }}
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-sm"
        >
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-3xl font-bold tracking-tight mb-1">
            Something went wrong
          </h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-sm">
            An unexpected error occurred. Please try again.
            {error.digest ? (
              <>
                {" "}Reference: <code>{error.digest}</code>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          style={{ backgroundColor: "var(--lm-accent)", color: "var(--lm-bg)" }}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

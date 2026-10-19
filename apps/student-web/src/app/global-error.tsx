"use client";

/**
 * Last-resort error page (#8f). Next renders it in place of the root layout
 * when the layout itself, or anything not under an error.tsx, throws. It must
 * render its own <html> and <body> and gets none of the app's CSS, so it is
 * styled inline. The error text stays out of the page (it can hold hostnames
 * or connection strings); the digest lets support find the server log line.
 */
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // An error boundary swallows the error, so Sentry only hears of it here.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main role="alert" style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 24px" }}>
            An unexpected error occurred. Please try again.
            {error.digest ? (
              <>
                {" "}Reference: <code>{error.digest}</code>
              </>
            ) : null}
          </p>
          <button type="button" onClick={reset} style={{ padding: "10px 24px", borderRadius: 10, border: 0, background: "#0f172a", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

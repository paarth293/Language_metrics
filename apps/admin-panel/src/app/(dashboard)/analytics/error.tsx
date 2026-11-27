"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-[1230px] px-6 pb-8 pt-6 max-[900px]:px-5 max-[640px]:px-4">
      <div role="alert" className="lm-panel mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>
        <h1 className="lm-page-title text-[20px]">Unable to load analytics</h1>
        <p className="lm-body-copy mt-2 text-[13px]">
          An unexpected error occurred while rendering Reports &amp; Analytics. Please try again.
          {error.digest ? (
            <>
              {" "}
              Reference: <code className="font-mono text-[12px]">{error.digest}</code>
            </>
          ) : null}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="lm-button-primary min-h-9 px-4 text-[12px] flex items-center gap-2">
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
          <Link href="/" className="lm-button-secondary min-h-9 px-4 text-[12px] flex items-center gap-2">
            <ArrowLeft size={14} aria-hidden="true" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

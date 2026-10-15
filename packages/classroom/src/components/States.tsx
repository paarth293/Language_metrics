"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TokenError } from "../types";

export function FullscreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="text-sm text-text-muted">{label}</span>
      </div>
    </div>
  );
}

export function JoinBlocked({
  error,
  exitHref,
  onRetry,
}: {
  error: TokenError;
  exitHref: string;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!error.joinOpensAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [error.joinOpensAt]);

  const opensIn = error.joinOpensAt
    ? Math.max(0, new Date(error.joinOpensAt).getTime() - now)
    : null;

  // Once the doors open, retry automatically instead of making the student
  // guess when to press the button again.
  useEffect(() => {
    if (opensIn === 0) onRetry();
  }, [opensIn, onRetry]);

  const headline: Record<string, string> = {
    TOO_EARLY: "Not quite yet",
    TOO_LATE: "This class has closed",
    SESSION_COMPLETED: "This class has finished",
    SESSION_CANCELLED: "This class was cancelled",
    NOT_A_PARTICIPANT: "You are not in this class",
    NOT_CONFIGURED: "Live classes are unavailable",
    BUDGET_EXCEEDED: "Live classes are temporarily paused",
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-xl font-bold text-text mb-2">
          {headline[error.code] ?? "Unable to join"}
        </h2>
        <p className="text-text-muted mb-6">{error.message}</p>

        {opensIn !== null && opensIn > 0 && (
          <p className="text-3xl font-semibold text-brand tabular-nums mb-6">
            {Math.floor(opensIn / 60_000)}:
            {String(Math.floor((opensIn % 60_000) / 1000)).padStart(2, "0")}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <a
            href={exitHref}
            className="px-4 py-2 rounded-xl border border-border text-sm text-text-muted hover:text-text transition-colors"
          >
            Back to classes
          </a>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-all"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

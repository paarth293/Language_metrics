"use client";

import { useEffect } from "react";

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TeacherError]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center p-8 rounded-2xl border border-border bg-white">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-text mb-2">Something went wrong</h2>
        <p className="text-text-muted text-sm mb-6">
          {error?.message?.includes("fetch") ? "Network error — check your connection." : "An unexpected error occurred."}
        </p>
        <button onClick={reset} className="px-6 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all">
          Try Again
        </button>
      </div>
    </div>
  );
}

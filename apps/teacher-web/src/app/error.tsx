"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
          <TriangleAlert className="w-8 h-8 text-danger" />
        </div>
        <h2 className="font-display text-xl font-bold text-text mb-2">
          Something went wrong
        </h2>
        <p className="text-text-muted text-sm mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl bg-navy text-white font-medium text-sm hover:bg-navy-2 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

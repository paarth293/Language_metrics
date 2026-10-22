"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[StudentError]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center p-8 rounded-2xl border border-border bg-white">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
          <TriangleAlert className="w-8 h-8 text-danger" />
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

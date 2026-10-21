"use client";

/**
 * StaleDataNotice — non-blocking banner for data that failed to refresh.
 *
 * Pages used to replace their whole body with an error card whenever a fetch
 * failed, discarding content that was still perfectly readable. With
 * stale-while-revalidate the previous payload is still there, so a failed
 * refresh should say so and offer a retry rather than take the page away.
 * The counterpart — a full error card — is still correct when nothing has
 * ever loaded.
 */

import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "./cn";

export interface StaleDataNoticeProps {
  /** Retry handler, normally the `refetch` returned by useResource. */
  onRetry?: () => void;
  /** Epoch ms of the data currently on screen, used for "as of" wording. */
  updatedAt?: number;
  className?: string;
  children?: ReactNode;
}

function asOf(updatedAt?: number): string | null {
  if (!updatedAt) return null;
  const seconds = Math.round((Date.now() - updatedAt) / 1000);
  if (seconds < 60) return "a moment ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(updatedAt).toLocaleString();
}

export function StaleDataNotice({ onRetry, updatedAt, className, children }: StaleDataNoticeProps) {
  const when = asOf(updatedAt);
  return (
    <div
      role="status"
      className={cn(
        "mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-alert/30 bg-alert/5 px-3 py-2 text-[12px] text-text-muted",
        className
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-alert" aria-hidden />
      <span className="font-medium text-text">
        {children ?? "Couldn't refresh — showing the last data we loaded"}
      </span>
      {when && <span className="text-text-subtle">(updated {when})</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-text transition-colors hover:bg-surface-inset"
        >
          <RotateCw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}

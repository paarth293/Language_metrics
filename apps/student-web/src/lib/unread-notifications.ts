import { useSyncExternalStore } from "react";

let currentCount: number = 0;
let inFlightPromise: Promise<number> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Fetches the student's unread notification count, deduplicating concurrent requests.
 * If a fetch is already in flight, returns the existing promise instead of making
 * a duplicate network call.
 */
export async function fetchUnreadCount(signal?: AbortSignal): Promise<number> {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const res = await fetch("/api/students/notifications/unread-count", {
        credentials: "include",
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.unreadCount === "number") {
          currentCount = data.unreadCount;
          emitChange();
          return currentCount;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return currentCount;
      }
    } finally {
      inFlightPromise = null;
    }
    return currentCount;
  })();

  return inFlightPromise;
}

/**
 * Manually update the shared unread count (e.g. from a notifications-updated event).
 */
export function setSharedUnreadCount(count: number) {
  currentCount = Math.max(0, count);
  emitChange();
}

/**
 * Reset count on logout.
 */
export function resetSharedUnreadCount() {
  currentCount = 0;
  inFlightPromise = null;
  emitChange();
}

export function subscribeUnreadCount(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUnreadCountSnapshot(): number {
  return currentCount;
}

/**
 * Hook to read the shared unread notification count across components (Sidebar, TopBar, etc.).
 */
export function useSharedUnreadCount(initialCount?: number): number {
  return useSyncExternalStore(
    subscribeUnreadCount,
    getUnreadCountSnapshot,
    () => initialCount ?? 0
  );
}

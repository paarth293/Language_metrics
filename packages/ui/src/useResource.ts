"use client";

/**
 * useResource — stale-while-revalidate data hook over the module-level
 * `resource-cache` store.
 *
 * Replaces the `useState` + `useEffect(fetch)` + `if (loading) return
 * <Skeleton/>` pattern that every authenticated page used. The difference
 * that matters for the UI: cached data is returned on the very first render
 * after a navigation, so revisiting a page paints instantly and the network
 * request runs underneath. `isLoading` is true only when there is genuinely
 * nothing to show, which is the one case where a skeleton is correct.
 *
 * Freshness is accounted for rather than guessed: a tab resume revalidates
 * only keys older than `staleMs`, and concurrent callers of the same key
 * share one request.
 *
 * Changing the key shows that key's own state — cached data if it has any,
 * otherwise a loading state. The previous key's payload is never carried
 * over: under a new filter or a new week it would be wrong, not merely stale.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  fetchResource,
  getEntry,
  mutateResource,
  subscribe,
  type CacheEntry,
} from "./resource-cache";

export interface UseResourceOptions {
  /**
   * How long a successful response is reused without a network request.
   * Also the threshold a tab resume or a remount checks before revalidating.
   * Default 30s — long enough that clicking between sidebar items is free,
   * short enough that data on screen is never meaningfully old.
   */
  staleMs?: number;
  /** Revalidate stale data when the tab becomes visible again. Default true. */
  revalidateOnFocus?: boolean;
  /**
   * Background poll interval, in ms, while the tab is visible. 0 disables it.
   * Polling pauses while the tab is hidden and resumes on return.
   */
  pollMs?: number;
  /** Set false to hold off fetching (waiting on auth, or on a route param). */
  enabled?: boolean;
}

export interface Resource<T> {
  /** Cached payload, or undefined when this key has never resolved. */
  data: T | undefined;
  /** Error from the latest failed attempt. `data` may still be present. */
  error: unknown;
  /** True only when there is nothing to render yet — the one time to show a skeleton. */
  isLoading: boolean;
  /** True while a request is in flight over data that is already on screen. */
  isRevalidating: boolean;
  /** True when the latest attempt failed and `data` is from an earlier load. */
  isStale: boolean;
  /** Epoch ms of the last success, 0 if never. */
  updatedAt: number;
  /** Force a request now, bypassing the freshness check. */
  refetch: () => Promise<void>;
  /** Write a payload into the cache (optimistic update). */
  mutate: (data: T) => void;
}

/** Shared across hook instances so one entry is never polled by two timers. */
function isVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function useResource<T>(
  /** Cache key — use the request URL. `null` disables the hook. */
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseResourceOptions = {}
): Resource<T> {
  const {
    staleMs = 30_000,
    revalidateOnFocus = true,
    pollMs = 0,
    enabled = true,
  } = options;

  const active = enabled && key !== null;

  // The fetcher is read through a ref so a new inline closure on every render
  // does not restart the effects below. It is synced in an effect declared
  // before them, which React runs first, so they always see the latest one.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const entry = useSyncExternalStore<CacheEntry<T>>(
    useCallback((cb) => (key === null ? () => {} : subscribe(key, cb)), [key]),
    useCallback(() => (key === null ? getEntry<T>("") : getEntry<T>(key)), [key]),
    useCallback(() => getEntry<T>(""), [])
  );

  const load = useCallback(
    (force: boolean) => {
      if (!active || key === null) return Promise.resolve();
      const current = getEntry<T>(key);
      if (!force && current.updatedAt > 0 && Date.now() - current.updatedAt < staleMs) {
        return Promise.resolve();
      }
      return fetchResource<T>(key, () => fetcherRef.current());
    },
    [active, key, staleMs]
  );

  // Mount / key change: paint what is cached, then revalidate if it is stale.
  useEffect(() => {
    if (!active) return;
    void load(false);
  }, [active, load]);

  // The entry has no data, no error and nothing in flight. That is either the
  // first visit or the cache being emptied under a mounted page — a logout, an
  // account switch, or an explicit invalidation. Either way this key has to be
  // requested again; without this, a wipe would leave the page on a skeleton
  // forever.
  const needsLoad = entry.updatedAt === 0 && entry.failedAt === 0 && entry.promise === undefined;
  useEffect(() => {
    if (!active || !needsLoad) return;
    void load(true);
  }, [active, needsLoad, load]);

  // Tab resume. Only keys older than `staleMs` are requested, so returning to
  // a tab does not re-issue every call on the page.
  useEffect(() => {
    if (!active || !revalidateOnFocus || typeof document === "undefined") return;
    const onVisibility = () => {
      if (isVisible()) void load(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, revalidateOnFocus, load]);

  // Background poll, paused while hidden and restarted on return.
  //
  // The next tick is timed from when the data actually landed, not from when
  // this effect ran. That is what stops a tab resume from firing every poll on
  // the page at once: a key refreshed moments ago just gets a shorter timer,
  // and only one whose interval has genuinely elapsed is requested.
  useEffect(() => {
    if (!active || !pollMs || key === null || typeof document === "undefined") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      const lastLoad = getEntry(key).updatedAt;
      // Never loaded: the mount effect above is already fetching, so wait a
      // whole interval rather than firing a duplicate immediately.
      const elapsed = lastLoad ? Date.now() - lastLoad : 0;
      timer = setTimeout(tick, Math.max(0, pollMs - elapsed));
    };
    const tick = () => {
      if (cancelled) return;
      // Hidden: drop the timer rather than burning one in a background tab.
      // The visibility listener below restarts the loop.
      if (!isVisible()) return;
      // Something else may have refreshed this key in the meantime — the
      // focus revalidation above, or another component sharing it. Re-arm
      // instead of issuing a redundant request.
      const lastLoad = getEntry(key).updatedAt;
      if (lastLoad && Date.now() - lastLoad < pollMs) {
        schedule();
        return;
      }
      void load(true).finally(() => {
        if (!cancelled) schedule();
      });
    };

    schedule();
    const onVisibility = () => {
      if (!cancelled && isVisible()) schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, pollMs, key, load]);

  const refetch = useCallback(() => load(true), [load]);
  const mutate = useCallback(
    (data: T) => {
      if (key !== null) mutateResource<T>(key, data);
    },
    [key]
  );

  const data = entry.data;

  return {
    data,
    error: entry.error,
    isLoading: data === undefined && entry.failedAt === 0,
    isRevalidating: entry.promise !== undefined,
    isStale: entry.failedAt > entry.updatedAt && data !== undefined,
    updatedAt: entry.updatedAt,
    refetch,
    mutate,
  };
}

/**
 * Convenience wrapper for the common case: a JSON GET against the app's own
 * API with cookies attached, keyed by its URL.
 */
export function useJsonResource<T>(
  url: string | null,
  options: UseResourceOptions = {}
): Resource<T> {
  const fetcher = useCallback(async () => {
    const res = await fetch(url as string, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  }, [url]);
  return useResource<T>(url, fetcher, options);
}

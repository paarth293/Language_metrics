"use client";

/**
 * useStickyState — useState that survives a route change.
 *
 * Tabs, search terms, filters and pagination lived in component state, so
 * navigating to another sidebar item and back reset every one of them. This
 * keeps the value in the same module-level store the data cache uses, which
 * means it outlives unmounts and — importantly — is wiped by the same logout
 * and account-switch handling, so one user's search terms never leak into
 * another's session.
 *
 * It is deliberately in-memory only: a full page load starts fresh, which is
 * the right default for a filter nobody asked to have remembered forever.
 */

import { useCallback, useSyncExternalStore } from "react";
import { getEntry, mutateResource, subscribe } from "./resource-cache";

/** Namespaced away from request URLs so the two can never collide. */
const prefix = "ui-state:";

export function useStickyState<T>(
  /** Stable, route-scoped identifier, e.g. "teacher/sessions:tab". */
  key: string,
  initial: T
): [T, (next: T) => void] {
  const storeKey = prefix + key;

  const stored = useSyncExternalStore(
    useCallback((cb) => subscribe(storeKey, cb), [storeKey]),
    useCallback(() => getEntry<T>(storeKey).data, [storeKey]),
    useCallback(() => undefined, [])
  );

  const set = useCallback((next: T) => mutateResource<T>(storeKey, next), [storeKey]);

  return [stored === undefined ? initial : stored, set];
}

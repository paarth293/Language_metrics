"use client";

/**
 * useDebouncedValue — settle a fast-changing value before it reaches a
 * cache key or a request.
 *
 * The teacher discovery page fetched on every keystroke: typing "spanish"
 * fired seven overlapping requests, each of which had to be waited on and
 * each of which re-rendered the results grid. Debouncing the term before it
 * becomes part of the URL means one request per word, and the cache keyed on
 * the settled term makes backspacing free.
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
    // `settled` is read only to skip a no-op timer; including it would restart
    // the timer on every settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);

  return settled;
}

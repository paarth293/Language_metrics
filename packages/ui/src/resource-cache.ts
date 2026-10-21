/**
 * resource-cache.ts — module-level client cache for browser data fetches
 *
 * Every authenticated page in student-web and teacher-web used to hold its API
 * response in component `useState`. React Router unmounts a page's component
 * when you navigate to a sibling route, so that state was destroyed on every
 * navigation: coming back re-ran the fetch from zero and the page rendered its
 * full-screen skeleton again even though the data had been on screen a second
 * earlier. Tab switches made it worse — each `visibilitychange` listener
 * refetched unconditionally, with no idea how fresh the data already was.
 *
 * This store lives outside the React tree, so it survives unmounts. It gives:
 *   - stale-while-revalidate: cached data renders immediately, the network
 *     request happens behind it, and the UI never blanks,
 *   - in-flight de-duplication: a Sidebar, a TopBar and a page asking for the
 *     same key at the same moment share one request,
 *   - freshness accounting, so a tab resume only refetches what is actually
 *     stale,
 *   - an owner scope: the cache is tied to a user id and is wiped whenever
 *     that id changes, so a logout or an account switch can never show the
 *     previous user's data.
 *
 * Keys are the request URL (including its query string), which makes them
 * naturally per-resource. They are NOT per-user — the owner scope is what
 * isolates users, and it must be set from the auth provider.
 */

export interface CacheEntry<T = unknown> {
  /** Last successful payload, or undefined if this key never resolved. */
  data: T | undefined;
  /** Error from the most recent failed attempt, cleared by a success. */
  error: unknown;
  /** Epoch ms of the last success. 0 means "never loaded". */
  updatedAt: number;
  /** Epoch ms of the last failure. 0 means "no failure since the last success". */
  failedAt: number;
  /** Shared promise while a request for this key is in flight. */
  promise?: Promise<void>;
}

const EMPTY: CacheEntry = { data: undefined, error: undefined, updatedAt: 0, failedAt: 0 };

/** Soft ceiling on retained keys; unobserved entries are evicted oldest-first. */
const MAX_ENTRIES = 200;

const store = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

/**
 * Identity the cached data belongs to. `undefined` means "not yet known"
 * (auth still hydrating) and is deliberately distinct from `null`
 * ("definitely signed out"), so the first hydration does not wipe a cache
 * that was just populated.
 */
let owner: string | null | undefined = undefined;

export function getEntry<T>(key: string): CacheEntry<T> {
  return (store.get(key) as CacheEntry<T> | undefined) ?? (EMPTY as CacheEntry<T>);
}

function notify(key: string) {
  const subs = listeners.get(key);
  if (!subs) return;
  // Copy: a listener may unsubscribe itself while being notified.
  for (const cb of Array.from(subs)) cb();
}

function notifyAll() {
  for (const key of Array.from(listeners.keys())) notify(key);
}

function write(key: string, next: CacheEntry) {
  store.set(key, next);
  notify(key);
}

/** Drop unobserved entries once the store grows past MAX_ENTRIES. */
function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const evictable = Array.from(store.entries())
    .filter(([key, entry]) => !entry.promise && !listeners.get(key)?.size)
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [key] of evictable) {
    if (store.size <= MAX_ENTRIES) break;
    store.delete(key);
  }
}

export function subscribe(key: string, cb: () => void): () => void {
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(cb);
  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(cb);
    if (current.size === 0) listeners.delete(key);
  };
}

/**
 * Fetch `key` through `fetcher`, de-duplicating concurrent callers.
 *
 * A request already in flight is awaited rather than issued again, so a tab
 * resume that fires several revalidations at once still makes one call per
 * key. On failure the previous `data` is kept and `error` is set, which is
 * what lets a page keep rendering while showing a retry affordance.
 */
export function fetchResource<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  const existing = store.get(key);
  if (existing?.promise) return existing.promise;

  const base: CacheEntry<T> = (existing as CacheEntry<T> | undefined) ?? {
    data: undefined,
    error: undefined,
    updatedAt: 0,
    failedAt: 0,
  };

  // Which owner this request was started for. If the user changes while it is
  // in flight, the response is discarded instead of landing in the new user's
  // cache.
  const startedFor = owner;

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (owner !== startedFor) return;
      write(key, { data, error: undefined, updatedAt: Date.now(), failedAt: 0 });
    } catch (error) {
      if (owner !== startedFor) return;
      const prev = store.get(key);
      write(key, {
        data: prev?.data,
        error,
        updatedAt: prev?.updatedAt ?? 0,
        failedAt: Date.now(),
      });
    } finally {
      if (owner === startedFor) {
        const settled = store.get(key);
        if (settled?.promise) store.set(key, { ...settled, promise: undefined });
        evictIfNeeded();
      }
    }
  })();

  // Published before the first await resolves so a second caller in the same
  // tick joins this request instead of starting its own.
  store.set(key, { ...base, promise });
  notify(key);
  return promise;
}

/** Write a payload directly — for optimistic updates after a mutation. */
export function mutateResource<T>(key: string, data: T) {
  const prev = store.get(key);
  write(key, { data, error: undefined, updatedAt: Date.now(), failedAt: 0, promise: prev?.promise });
}

/**
 * Mark every key starting with `prefix` as stale without discarding its data.
 *
 * Mounted pages revalidate on the next tick but keep showing what they have,
 * so a mutation refreshes the numbers in place instead of flashing the page
 * back to a skeleton. Use `clearCache` when the data must actually disappear.
 */
export function invalidateResource(prefix: string) {
  for (const [key, entry] of store) {
    if (!key.startsWith(prefix)) continue;
    store.set(key, { ...entry, updatedAt: 0 });
    notify(key);
  }
}

/**
 * Discard everything. Called on logout and whenever the signed-in user
 * changes, so protected data is never readable by the next session.
 */
export function clearCache() {
  store.clear();
  notifyAll();
}

/**
 * Bind the cache to a user id. A change wipes the store, which is the
 * guarantee that account switching cannot surface the previous user's data.
 */
export function setCacheOwner(next: string | null) {
  if (owner === next) return;
  const had = owner !== undefined;
  owner = next;
  // The first resolution (undefined -> id) is hydration, not a switch: the
  // cache is either empty or was filled by this same user moments ago.
  if (had) clearCache();
}

export function getCacheOwner(): string | null | undefined {
  return owner;
}

/** Test helper: reset store, subscribers and owner to a pristine state. */
export function __resetCacheForTests() {
  store.clear();
  listeners.clear();
  owner = undefined;
}

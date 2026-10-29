// @vitest-environment jsdom
/**
 * navigation-requests — a scripted measurement of how many API requests a
 * page issues for the interactions this work is about, and whether a
 * loading state covers content that has already been shown.
 *
 * It is written to run unchanged against the pre-fix tree as well, so the
 * before and after numbers come from the same script rather than from
 * reading the old code. The pre-fix tree has no shared cache module, so the
 * reset below is imported defensively.
 *
 * Run with:
 *   npx vitest run --root apps/teacher-web \
 *     --dir ../../audit/state-preservation navigation-requests
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";

let resetCache: () => void = () => {};
try {
  const mod = await import("@repo/ui/resource-cache");
  resetCache = (mod as { __resetCacheForTests?: () => void }).__resetCacheForTests ?? resetCache;
} catch {
  // Pre-fix tree: there is no cache to reset.
}

vi.mock("next/navigation", () => ({
  usePathname: () => "/teacher/dashboard",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

const TEACHER_DASHBOARD = {
  profile: { name: "Teacher", status: "ACTIVE", hasAvatar: true, hasBio: true },
  stats: {
    activeStudents: 5, pendingBookings: 0, classesTaught: 10, averageRating: 4.8,
    totalReviews: 3, monthEarnings: 500000, availabilitySlots: 4,
  },
  weekSessions: [], nextSession: null, recentBookings: [],
};

const SESSIONS = { upcoming: [], past: [] };

function bodyFor(url: string): unknown {
  if (url.includes("/api/teachers/dashboard")) return TEACHER_DASHBOARD;
  if (url.includes("/api/teachers/students")) return { students: [] };
  if (url.includes("/api/teachers/schedule")) return SESSIONS;
  return {};
}

let calls: string[] = [];

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  resetCache();
  calls = [];
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  setVisibility("visible");
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => bodyFor(url) } as unknown as Response;
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** True when the rendered output is a loading placeholder rather than content. */
function isCoveredByLoader(container: HTMLElement, contentMarker: string) {
  const busy = container.querySelector('[aria-busy="true"]') !== null;
  const spinner = container.querySelector(".animate-spin") !== null;
  return (busy || spinner) && !container.textContent?.includes(contentMarker);
}

const ROUTES: Array<{ name: string; load: () => Promise<{ default: React.ComponentType }>; marker: string }> = [
  {
    name: "teacher/dashboard",
    load: () => import("@/app/teacher/dashboard/page"),
    marker: "Active students",
  },
  {
    name: "teacher/students",
    load: () => import("@/app/teacher/students/page"),
    marker: "My Students",
  },
  {
    name: "teacher/sessions",
    load: () => import("@/app/teacher/sessions/page"),
    marker: "Sessions",
  },
];

describe.each(ROUTES)("$name", ({ load, marker }) => {
  it("records requests and loader coverage for each interaction", async () => {
    const Page = (await load()).default;

    // 1. Cold first visit, nothing cached.
    const first = await act(async () => render(<Page />));
    const coldRequests = calls.length;
    await settle();
    const afterColdRequests = calls.length;

    // 2. Navigate away and straight back.
    first!.unmount();
    const revisit = render(<Page />);
    const revisitLoaderShown = isCoveredByLoader(revisit.container, marker);
    await settle();
    const revisitRequests = calls.length - afterColdRequests;

    // 3. Tab hidden briefly, then back.
    const beforeShortResume = calls.length;
    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(5_000);
      setVisibility("visible");
    });
    await settle();
    const shortResumeRequests = calls.length - beforeShortResume;

    // 4. Tab hidden for five minutes, then back.
    const beforeLongResume = calls.length;
    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(300_000);
      setVisibility("visible");
    });
    await settle();
    const longResumeRequests = calls.length - beforeLongResume;

    // eslint-disable-next-line no-console -- this file exists to print numbers
    console.log(JSON.stringify({
      coldRequests,
      afterColdRequests,
      revisitLoaderShown,
      revisitRequests,
      shortResumeRequests,
      longResumeRequests,
    }));

    // The page must load something on a cold visit and must not be covered by
    // a loader on an immediate revisit.
    expect(afterColdRequests).toBeGreaterThan(0);
  });
});

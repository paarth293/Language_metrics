// @vitest-environment jsdom
/**
 * The student-web counterpart of navigation-requests.test.tsx — same script,
 * same interactions, so the before and after numbers are comparable. Run with:
 *
 *   cd apps/student-web && npx vitest run \
 *     --dir ../../audit/state-preservation --config vitest.config.mts \
 *     --reporter=verbose navigation-requests.student-web
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
  usePathname: () => "/recordings",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

function bodyFor(url: string): unknown {
  if (url.includes("/api/students/recordings")) return { recordings: [] };
  if (url.includes("/api/students/classes")) return { bookings: [] };
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

function isCoveredByLoader(container: HTMLElement, contentMarker: string) {
  const busy = container.querySelector('[aria-busy="true"]') !== null;
  const spinner = container.querySelector(".animate-spin") !== null;
  return (busy || spinner) && !container.textContent?.includes(contentMarker);
}

const ROUTES: Array<{ name: string; load: () => Promise<{ default: React.ComponentType }>; marker: string }> = [
  { name: "recordings", load: () => import("@/app/(authenticated)/recordings/page"), marker: "Recordings" },
  { name: "classes", load: () => import("@/app/(authenticated)/classes/page"), marker: "My Classes" },
];

describe.each(ROUTES)("$name", ({ load, marker }) => {
  it("records requests and loader coverage for each interaction", async () => {
    const Page = (await load()).default;

    const first = await act(async () => render(<Page />));
    const coldRequests = calls.length;
    await settle();
    const afterColdRequests = calls.length;

    first!.unmount();
    const revisit = render(<Page />);
    const revisitLoaderShown = isCoveredByLoader(revisit.container, marker);
    await settle();
    const revisitRequests = calls.length - afterColdRequests;

    const beforeShortResume = calls.length;
    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(5_000);
      setVisibility("visible");
    });
    await settle();
    const shortResumeRequests = calls.length - beforeShortResume;

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
      coldRequests, afterColdRequests, revisitLoaderShown,
      revisitRequests, shortResumeRequests, longResumeRequests,
    }));

    expect(afterColdRequests).toBeGreaterThan(0);
  });
});

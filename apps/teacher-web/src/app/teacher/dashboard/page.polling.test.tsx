// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { __resetCacheForTests } from "@repo/ui/resource-cache";
import TeacherDashboard from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/teacher/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Mock useNow
vi.mock("@/lib/class-join", () => ({
  useNow: () => Date.now(),
}));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("TeacherDashboard Visibility-Aware Polling", () => {
  let fetchCalls: string[] = [];

  beforeEach(() => {
    // The data cache is module-level and deliberately outlives unmounts, so
    // each test starts from an empty one.
    __resetCacheForTests();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    setVisibility("visible");
    fetchCalls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        fetchCalls.push(url);
        return {
          ok: true,
          json: async () => ({
            profile: { name: "Teacher", status: "ACTIVE", hasAvatar: false, hasBio: true },
            stats: { activeStudents: 5, pendingBookings: 0, classesTaught: 10, averageRating: 5, totalReviews: 3, monthEarnings: 5000, availabilitySlots: 4 },
            weekSessions: [],
            nextSession: null,
            recentBookings: [],
          }),
        };
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads immediately on mount when visible", async () => {
    await act(async () => {
      render(<TeacherDashboard />);
    });
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]).toContain("/api/teachers/dashboard");
  });

  it("pauses polling when document is hidden and resumes immediately when visible", async () => {
    await act(async () => {
      render(<TeacherDashboard />);
    });
    expect(fetchCalls.length).toBe(1);

    // Hide document
    await act(async () => {
      setVisibility("hidden");
    });

    // Advance 65 seconds while hidden
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });

    // No new fetch calls should happen while hidden!
    expect(fetchCalls.length).toBe(1);

    // Return to visible tab
    await act(async () => {
      setVisibility("visible");
    });

    // The cached payload is now older than the 30s freshness window, so
    // becoming visible revalidates it.
    expect(fetchCalls.length).toBe(2);

    // Advance another 60 seconds while visible
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchCalls.length).toBe(3);
  });

  it("does not refetch on a tab resume while the data is still fresh", async () => {
    await act(async () => {
      render(<TeacherDashboard />);
    });
    expect(fetchCalls.length).toBe(1);

    // Well inside the 30s freshness window: returning to the tab is free.
    await act(async () => {
      setVisibility("hidden");
      await vi.advanceTimersByTimeAsync(5_000);
      setVisibility("visible");
    });
    expect(fetchCalls.length).toBe(1);
  });

  it("paints cached data instead of the skeleton when the page is revisited", async () => {
    const first = await act(async () => render(<TeacherDashboard />));
    expect(fetchCalls.length).toBe(1);
    first!.unmount();

    // A navigation back to the dashboard: a new component instance reading the
    // same cache key. No skeleton, and no second request.
    const again = render(<TeacherDashboard />);
    expect(again.container.querySelector('[aria-label="Loading dashboard"]')).toBeNull();
    expect(again.container.textContent).toContain("Active students");
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetchCalls.length).toBe(1);
  });
});

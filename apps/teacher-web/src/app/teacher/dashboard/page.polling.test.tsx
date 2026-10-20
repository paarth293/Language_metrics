// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
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

    // An immediate refresh should be triggered upon becoming visible
    expect(fetchCalls.length).toBe(2);

    // Advance another 60 seconds while visible
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchCalls.length).toBe(3);
  });
});

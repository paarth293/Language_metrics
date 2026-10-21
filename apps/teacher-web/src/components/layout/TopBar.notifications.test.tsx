// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { TopBar } from "./TopBar";
import type { User } from "@/types";

// Mock router / pathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/student/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Mock ThemeProvider
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

const mockNavItems = [
  { label: "Dashboard", href: "/student/dashboard", icon: () => null },
  { label: "Find Teacher", href: "/student/discover", icon: () => null },
];

describe("TopBar unread notifications auth gating", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT make any network request when user is null (auth in-flight)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await act(async () => {
      render(
        <TopBar onMenuClick={vi.fn()} user={null} navItems={mockNavItems} />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches /api/students/notifications/unread-count when user is a STUDENT", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 3 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const studentUser: User = {
      id: "student-1",
      name: "Student One",
      role: "STUDENT",
      email: "student@example.test",
    };

    await act(async () => {
      render(
        <TopBar onMenuClick={vi.fn()} user={studentUser} navItems={mockNavItems} />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/students/notifications/unread-count", expect.anything());
  });

  it("fetches /api/teachers/notifications/unread-count when user is a TEACHER", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 2 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const teacherUser: User = {
      id: "teacher-1",
      name: "Teacher One",
      role: "TEACHER",
      email: "teacher@example.test",
    };

    await act(async () => {
      render(
        <TopBar onMenuClick={vi.fn()} user={teacherUser} navItems={mockNavItems} />
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/teachers/notifications/unread-count", expect.anything());
  });
});

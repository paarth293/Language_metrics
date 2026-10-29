// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { resetSharedUnreadCount } from "../../lib/unread-notifications";
import type { User } from "@/types";

// Mock router / pathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Student User", role: "STUDENT" },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// Mock ThemeProvider
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

const mockNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: () => null },
  { label: "Notifications", href: "/notifications", icon: () => null },
];

describe("Unread Notifications Request Deduplication", () => {
  beforeEach(() => {
    resetSharedUnreadCount();
    vi.restoreAllMocks();
  });

  it("fires exactly ONE network request when Sidebar and TopBar mount together", async () => {
    let requestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/students/notifications/unread-count")) {
          requestCount++;
          return {
            ok: true,
            json: async () => ({ unreadCount: 4 }),
          };
        }
        return { ok: true, json: async () => ({}) };
      })
    );

    const mockUser: User = { id: "1", name: "Test Student", role: "STUDENT", email: "test@test.com" };

    // Render both Sidebar and TopBar simultaneously, as AppShell does
    await act(async () => {
      render(
        <div>
          <Sidebar navItems={mockNavItems} isOpen={false} onClose={vi.fn()} />
          <TopBar onMenuClick={vi.fn()} user={mockUser} navItems={mockNavItems} />
        </div>
      );
    });

    // Allow any microtasks and timers to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // PROOF OF DEDUPLICATION: exactly 1 request sent instead of 2
    expect(requestCount).toBe(1);
  });

  it("does NOT fire unread-count fetch when user is null (auth in-flight or unauthenticated)", async () => {
    let requestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/students/notifications/unread-count")) {
          requestCount++;
          return {
            ok: true,
            json: async () => ({ unreadCount: 0 }),
          };
        }
        return { ok: true, json: async () => ({}) };
      })
    );

    await act(async () => {
      render(
        <div>
          <TopBar onMenuClick={vi.fn()} user={null} navItems={mockNavItems} />
        </div>
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // When user is null, unread-count must NOT be called (prevents 401s)
    expect(requestCount).toBe(0);
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { AppShell } from "./AppShell";
import type { User } from "@/types";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/teacher/dashboard",
}));

const authState = {
  user: null as User | null,
  isLoading: true,
  refreshUser: vi.fn(),
};

vi.mock("@/lib/auth-client", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("P3: teacher-web AppShell parallel auth check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = true;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders shell and children immediately while auth is in-flight (isLoading = true)", () => {
    render(
      <AppShell navItems={[]} requiredRole="TEACHER">
        <div data-testid="teacher-page-content">Teacher Page Content</div>
      </AppShell>
    );

    // Children must mount immediately so parallel data fetching can begin
    expect(screen.queryByTestId("teacher-page-content")).not.toBeNull();
    // Full screen spinner must NOT block children
    expect(screen.queryByText(/loading\.\.\./i)).toBeNull();
  });

  it("redirects to /login and hides children when resolved as unauthenticated (user = null, isLoading = false)", () => {
    authState.isLoading = false;
    authState.user = null;

    render(
      <AppShell navItems={[]} requiredRole="TEACHER">
        <div data-testid="teacher-page-content">Teacher Page Content</div>
      </AppShell>
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("teacher-page-content")).toBeNull();
  });

  it(
    "server-side authorization still blocks unauthenticated API requests with 401",
    async () => {
      const { GET } = await import("@/app/api/teachers/dashboard/route");
      const { NextRequest } = await import("next/server");
      const unauthenticatedRequest = new NextRequest("http://localhost/api/teachers/dashboard");

      const res = await GET(unauthenticatedRequest);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty("message");
      expect(data).not.toHaveProperty("upcomingClasses");
    },
    15000
  );
});

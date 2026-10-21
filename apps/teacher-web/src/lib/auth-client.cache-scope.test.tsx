// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import {
  __resetCacheForTests,
  fetchResource,
  getCacheOwner,
  getEntry,
} from "@repo/ui/resource-cache";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

import { AuthProvider, useAuth } from "./auth-client";

function Probe() {
  const { user, isLoading, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{isLoading ? "loading" : (user?.id ?? "anonymous")}</span>
      <button type="button" onClick={() => void logout()}>Log out</button>
    </div>
  );
}

function meResponds(user: { id: string } | null) {
  return vi.fn(async (input: string) => {
    if (input === "/api/auth/me") {
      return { ok: true, json: async () => ({ user }) } as unknown as Response;
    }
    return { ok: true, json: async () => ({}) } as unknown as Response;
  });
}

beforeEach(() => {
  __resetCacheForTests();
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuthProvider cache scoping", () => {
  it("binds the data cache to the signed-in user on hydration", async () => {
    vi.stubGlobal("fetch", meResponds({ id: "teacher-1" }));
    await act(async () => {
      render(<AuthProvider><Probe /></AuthProvider>);
    });
    expect(screen.getByTestId("user").textContent).toBe("teacher-1");
    expect(getCacheOwner()).toBe("teacher-1");
  });

  it("hydrating a signed-in user does not wipe data already cached for them", async () => {
    await fetchResource("/api/teachers/dashboard", async () => "dashboard");
    vi.stubGlobal("fetch", meResponds({ id: "teacher-1" }));
    await act(async () => {
      render(<AuthProvider><Probe /></AuthProvider>);
    });
    expect(getEntry("/api/teachers/dashboard").data).toBe("dashboard");
  });

  it("marks the cache anonymous when no session resolves", async () => {
    vi.stubGlobal("fetch", meResponds(null));
    await act(async () => {
      render(<AuthProvider><Probe /></AuthProvider>);
    });
    expect(screen.getByTestId("user").textContent).toBe("anonymous");
    expect(getCacheOwner()).toBeNull();
  });

  it("logging out discards every cached response", async () => {
    vi.stubGlobal("fetch", meResponds({ id: "teacher-1" }));
    await act(async () => {
      render(<AuthProvider><Probe /></AuthProvider>);
    });
    await fetchResource("/api/teachers/wallet", async () => ({ balance: 4200 }));
    expect(getEntry("/api/teachers/wallet").data).toEqual({ balance: 4200 });

    await act(async () => {
      screen.getByRole("button", { name: "Log out" }).click();
    });

    expect(getEntry("/api/teachers/wallet").data).toBeUndefined();
    expect(getCacheOwner()).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("a second account cannot read the first account's cached data", async () => {
    vi.stubGlobal("fetch", meResponds({ id: "teacher-1" }));
    const first = await act(async () => render(<AuthProvider><Probe /></AuthProvider>));
    await fetchResource("/api/teachers/earnings", async () => ({ paise: 999 }));
    first!.unmount();

    vi.stubGlobal("fetch", meResponds({ id: "teacher-2" }));
    await act(async () => {
      render(<AuthProvider><Probe /></AuthProvider>);
    });

    expect(getCacheOwner()).toBe("teacher-2");
    expect(getEntry("/api/teachers/earnings").data).toBeUndefined();
  });
});

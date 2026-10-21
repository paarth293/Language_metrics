import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { __resetCacheForTests, setCacheOwner } from "./resource-cache";
import { useResource } from "./useResource";

/**
 * These cover the UX contract the application-wide flicker fix depends on:
 * a revisit paints cached data instead of a skeleton, a tab resume only
 * refetches stale keys, and a failed refresh leaves what is on screen alone.
 */

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function Probe({
  fetcher,
  staleMs = 30_000,
  pollMs = 0,
  revalidateOnFocus = true,
  cacheKey = "/api/x",
}: {
  fetcher: () => Promise<string>;
  staleMs?: number;
  pollMs?: number;
  revalidateOnFocus?: boolean;
  cacheKey?: string;
}) {
  const r = useResource<string>(cacheKey, fetcher, { staleMs, pollMs, revalidateOnFocus });
  return (
    <div>
      <span data-testid="data">{r.data ?? "-"}</span>
      <span data-testid="loading">{String(r.isLoading)}</span>
      <span data-testid="revalidating">{String(r.isRevalidating)}</span>
      <span data-testid="stale">{String(r.isStale)}</span>
      <span data-testid="error">{r.error ? "yes" : "no"}</span>
    </div>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  __resetCacheForTests();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Let the hook's effects and the fetcher's microtasks settle. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useResource", () => {
  it("shows a loading state only on a first visit with nothing cached", async () => {
    const fetcher = vi.fn(async () => "first");
    render(<Probe fetcher={fetcher} />);
    expect(read("loading")).toBe("true");
    expect(read("data")).toBe("-");
    await settle();
    expect(read("loading")).toBe("false");
    expect(read("data")).toBe("first");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("paints cached data on a revisit without a loading state or a refetch", async () => {
    const fetcher = vi.fn(async () => "first");
    const first = render(<Probe fetcher={fetcher} />);
    await settle();
    first.unmount();

    // Navigating back: a brand-new component instance, same cache key.
    render(<Probe fetcher={fetcher} />);
    expect(read("loading")).toBe("false");
    expect(read("data")).toBe("first");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("revalidates a stale revisit in the background, keeping the old data visible", async () => {
    let value = "first";
    const fetcher = vi.fn(async () => value);
    const first = render(<Probe fetcher={fetcher} staleMs={1_000} />);
    await settle();
    first.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    value = "second";
    render(<Probe fetcher={fetcher} staleMs={1_000} />);
    // The stale payload is on screen for the first paint — never a skeleton.
    expect(read("loading")).toBe("false");
    expect(read("data")).toBe("first");
    await settle();
    expect(read("data")).toBe("second");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not refetch when the tab becomes visible and the data is fresh", async () => {
    const fetcher = vi.fn(async () => "first");
    render(<Probe fetcher={fetcher} staleMs={60_000} />);
    await settle();
    setVisibility("hidden");
    setVisibility("visible");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches once when the tab becomes visible and the data is stale", async () => {
    const fetcher = vi.fn(async () => "first");
    render(<Probe fetcher={fetcher} staleMs={1_000} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    setVisibility("hidden");
    setVisibility("visible");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("ignores tab resumes entirely when revalidateOnFocus is off", async () => {
    const fetcher = vi.fn(async () => "first");
    render(<Probe fetcher={fetcher} staleMs={1} revalidateOnFocus={false} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    setVisibility("visible");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves two components from one request", async () => {
    const fetcher = vi.fn(async () => "first");
    render(
      <div>
        <Probe fetcher={fetcher} />
        <Probe fetcher={fetcher} />
      </div>
    );
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps data visible and flags it stale when a refresh fails", async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error("offline");
      return "first";
    });
    render(<Probe fetcher={fetcher} staleMs={1_000} />);
    await settle();
    fail = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    setVisibility("visible");
    await settle();
    expect(read("data")).toBe("first");
    expect(read("stale")).toBe("true");
    expect(read("error")).toBe("yes");
    expect(read("loading")).toBe("false");
  });

  it("polls only while the tab is visible", async () => {
    const fetcher = vi.fn(async () => "first");
    render(<Probe fetcher={fetcher} pollMs={10_000} />);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops polling and detaches listeners after unmount", async () => {
    const fetcher = vi.fn(async () => "first");
    const view = render(<Probe fetcher={fetcher} pollMs={10_000} />);
    await settle();
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    setVisibility("visible");
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("drops cached data when the signed-in user changes", async () => {
    setCacheOwner("user-1");
    const fetcher = vi.fn(async () => "user-1 data");
    render(<Probe fetcher={fetcher} staleMs={60_000} />);
    await settle();
    expect(read("data")).toBe("user-1 data");

    await act(async () => {
      setCacheOwner("user-2");
    });
    // The previous user's payload is gone; the mounted hook refetches for the
    // new identity rather than showing what it already had.
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchUnreadCount,
  setSharedUnreadCount,
  resetSharedUnreadCount,
  getUnreadCountSnapshot,
  subscribeUnreadCount
} from "./unread-notifications";

describe("unread-notifications deduplication store", () => {
  beforeEach(() => {
    resetSharedUnreadCount();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent in-flight requests to /unread-count into a single fetch", async () => {
    let fetchCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        fetchCalls++;
        // Small delay to simulate network
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          json: async () => ({ unreadCount: 5 }),
        };
      })
    );

    // Call fetchUnreadCount simultaneously from what would be Sidebar and TopBar
    const promise1 = fetchUnreadCount();
    const promise2 = fetchUnreadCount();
    const promise3 = fetchUnreadCount();

    const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);

    expect(fetchCalls).toBe(1);
    expect(res1).toBe(5);
    expect(res2).toBe(5);
    expect(res3).toBe(5);
    expect(getUnreadCountSnapshot()).toBe(5);
  });

  it("notifies subscribers when count is updated manually or via event", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnreadCount(listener);

    setSharedUnreadCount(12);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getUnreadCountSnapshot()).toBe(12);

    unsubscribe();
    setSharedUnreadCount(3);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getUnreadCountSnapshot()).toBe(3);
  });

  it("resets count cleanly on logout", () => {
    setSharedUnreadCount(7);
    expect(getUnreadCountSnapshot()).toBe(7);

    resetSharedUnreadCount();
    expect(getUnreadCountSnapshot()).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRefresh } from "./fetch-with-refresh";

const reply = (status: number) => new Response("{}", { status });

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const refreshCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls.filter(([url]) => url === "/api/auth/refresh").length;

afterEach(() => vi.unstubAllGlobals());

describe("fetchWithRefresh", () => {
  it("passes through a response that is not a 401", async () => {
    const fetchMock = mockFetch(() => reply(200));
    expect((await fetchWithRefresh("/api/payments/create-order")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired session and retries the request", async () => {
    let expired = true;
    const fetchMock = mockFetch((url) => {
      if (url === "/api/auth/refresh") { expired = false; return reply(200); }
      return reply(expired ? 401 : 200);
    });
    expect((await fetchWithRefresh("/api/payments/create-order", { method: "POST" })).status).toBe(200);
    expect(refreshCalls(fetchMock)).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns the 401 when the refresh fails", async () => {
    const fetchMock = mockFetch(() => reply(401));
    expect((await fetchWithRefresh("/api/payments/create-order")).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends one refresh for parallel 401s, since a reused refresh token signs the user out", async () => {
    let expired = true;
    let finishRefresh!: () => void;
    const fetchMock = mockFetch((url) => {
      if (url !== "/api/auth/refresh") return reply(expired ? 401 : 200);
      return new Promise((resolve) => { finishRefresh = () => { expired = false; resolve(reply(200)); }; });
    });
    const both = Promise.all([fetchWithRefresh("/a"), fetchWithRefresh("/b")]);
    await vi.waitFor(() => expect(refreshCalls(fetchMock)).toBe(1));
    finishRefresh();
    expect((await both).map((r) => r.status)).toEqual([200, 200]);
    expect(refreshCalls(fetchMock)).toBe(1);
  });
});

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A real LiveKit "server" that accepts every request and never answers. The
// SDK talks to it for real (LIVEKIT_WS_URL points at it); only a timeout can
// end the call.
let server: Server;
let port = 0;
beforeAll(async () => {
  server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const realTimeout = AbortSignal.timeout.bind(AbortSignal);
let requested: number[] = [];

beforeEach(() => {
  vi.resetModules(); // fresh RoomServiceClient / EgressClient singletons
  requested = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    requested.push(ms);
    return realTimeout(200);
  });
  vi.stubEnv("LIVEKIT_WS_URL", `ws://127.0.0.1:${port}`);
  vi.stubEnv("LIVEKIT_API_KEY", "devkey");
  vi.stubEnv("LIVEKIT_API_SECRET", "devsecret-devsecret-devsecret-devsecret");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("LiveKit server calls give up on a LiveKit that never answers", () => {
  it("room setup fails within the 8 s timeout with a clear error", async () => {
    const { ensureClassRoom } = await import("./server");
    const started = Date.now();
    await expect(ensureClassRoom({ classSessionId: "s1" })).rejects.toThrow("LiveKit did not respond in time");
    expect(requested).toEqual([8_000]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("recording stop fails within the 8 s timeout with a clear error", async () => {
    const { stopClassRecording } = await import("./server");
    await expect(stopClassRecording("EG_1")).rejects.toThrow("LiveKit did not respond in time");
    expect(requested).toEqual([8_000]);
  });
});

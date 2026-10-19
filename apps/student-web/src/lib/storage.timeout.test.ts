import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A real storage endpoint that accepts every request and never answers. S3
// and Supabase are pointed at it through their env vars; only a timeout set by
// our code can end the upload.
let server: Server;
let slowUrl = "";
let hits = 0;
beforeAll(async () => {
  server = createServer(() => { hits++; });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  slowUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const realTimeout = AbortSignal.timeout.bind(AbortSignal);
let requested: number[] = [];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const options = { folder: "timeout-test", allowedTypes: ["image/png"] };

beforeEach(() => {
  vi.resetModules(); // storage.ts reads its provider at import
  requested = [];
  hits = 0;
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    requested.push(ms);
    return realTimeout(200);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function timed(promise: Promise<unknown>) {
  const started = Date.now();
  const error = await promise.then(() => null, (e: unknown) => e as Error);
  return { error, ms: Date.now() - started };
}

describe("uploads give up on a storage provider that never answers", () => {
  it("S3 upload fails within the request timeout", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    vi.stubEnv("STORAGE_ENDPOINT", slowUrl);
    vi.stubEnv("STORAGE_REGION", "us-east-1");
    vi.stubEnv("STORAGE_ACCESS_KEY", "key");
    vi.stubEnv("STORAGE_SECRET_KEY", "secret");
    const storage = await import("./storage");
    Object.assign(storage.STORAGE_TIMEOUTS, { connectionMs: 200, requestMs: 200 });
    const { error, ms } = await timed(storage.uploadFile(PNG, "a.png", "image/png", options));
    expect(error?.name).toBe("TimeoutError");
    expect(error?.message).toContain("requestTimeout");
    expect(hits).toBe(1); // the upload is not retried
    expect(ms).toBeLessThan(3_000);
  });

  it("uses a 5 s connection and 10 s request timeout for S3 in production", async () => {
    const { STORAGE_TIMEOUTS } = await import("./storage");
    expect(STORAGE_TIMEOUTS).toEqual({ connectionMs: 5_000, requestMs: 10_000 });
  });

  it("Supabase upload fails within 10 s", async () => {
    vi.stubEnv("STORAGE_PROVIDER", "supabase");
    vi.stubEnv("SUPABASE_URL", slowUrl);
    vi.stubEnv("SUPABASE_SERVICE_KEY", "service-key");
    const { uploadFile } = await import("./storage");
    const { error, ms } = await timed(uploadFile(PNG, "a.png", "image/png", options));
    expect(error).toBeInstanceOf(Error);
    expect(requested).toContain(10_000);
    expect(ms).toBeLessThan(3_000);
  });
});

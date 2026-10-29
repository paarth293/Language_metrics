import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Every Redis command fails, as while Upstash is unreachable.
vi.mock("@/lib/redis-client", () => {
  const fail = async () => {
    throw new Error("Connection is closed.");
  };
  return {
    getRedisClient: () => ({ exists: fail, incr: fail, expire: fail, set: fail, del: fail, get: fail }),
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: async () => null },
    adminUser: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/email", () => ({ sendVerificationOTP: async () => true }));
vi.mock("@/lib/otp", () => ({ generateOtp: () => "123456", hashOtp: async () => "hash" }));

function request(email: string) {
  return new NextRequest("http://localhost/api/auth/send-registration-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

describe("POST /api/auth/send-registration-otp when Redis commands fail", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("still rate-limits with the in-process fallback instead of skipping the limit", async () => {
    const { POST } = await import("./route");
    const email = `outage-${Date.now()}@example.test`;

    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await POST(request(email))).status);

    expect(statuses[2]).toBe(429);
  });
});

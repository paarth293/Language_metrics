import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// #8d: in production with no email provider configured, nothing may print
// the OTP. Before, the "dev fallback" in zoho-mailer printed it in production
// too, so anyone who can read the logs could take over a sign-up.
const OTP = "482913";

vi.mock("@/lib/redis-client", () => ({ getRedisClient: () => null }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async () => null } } }));
vi.mock("@/lib/otp", () => ({ generateOtp: () => OTP, hashOtp: async () => "hash" }));

let output: string[] = [];

beforeEach(() => {
  vi.resetModules();
  output = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    });
  }
  vi.stubEnv("NODE_ENV", "production");
  for (const name of ["ZOHO_SMTP_HOST", "ZOHO_EMAIL", "ZOHO_APP_PASSWORD", "RESEND_API_KEY", "REDIS_URL"]) {
    vi.stubEnv(name, "");
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function expectNoOtpInOutput() {
  expect(output.length).toBeGreaterThan(0); // something was logged, just not the code
  for (const line of output) expect(line).not.toContain(OTP);
}

describe("OTP codes never reach the console in production (#8d)", () => {
  it("sendVerificationOTP", async () => {
    const { sendVerificationOTP } = await import("./email");
    await sendVerificationOTP("someone@example.test", OTP);
    expectNoOtpInOutput();
  });

  it("sendPasswordResetOTP", async () => {
    const { sendPasswordResetOTP } = await import("./email");
    await sendPasswordResetOTP("someone@example.test", OTP);
    expectNoOtpInOutput();
  });

  it("POST /api/auth/send-registration-otp", async () => {
    const { POST } = await import("@/app/api/auth/send-registration-otp/route");
    await POST(
      new NextRequest("http://localhost/api/auth/send-registration-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `otp-${Date.now()}@example.test` }),
      }),
    );
    expectNoOtpInOutput();
  });
});

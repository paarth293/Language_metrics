import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "super-secret-value-123";

/** A complete production environment for teacher-web. */
const full = (): Record<string, string> => ({
  NODE_ENV: "production",
  DATABASE_URL: `postgresql://u:${SECRET}@db.example.test:6543/app`,
  JWT_PRIVATE_KEY: SECRET,
  JWT_PUBLIC_KEY: "public-key",
  REDIS_URL: `rediss://default:${SECRET}@redis.example.test:6379`,
  CASHFREE_ENV: "production",
  CASHFREE_CLIENT_ID: "app-id",
  CASHFREE_CLIENT_SECRET: SECRET,
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: SECRET,
  LIVEKIT_WS_URL: "wss://live.example.test",
  STORAGE_PROVIDER: "s3",
  STORAGE_ACCESS_KEY: "access",
  STORAGE_SECRET_KEY: SECRET,
});

/** `env` minus the named variables. */
function without(env: Record<string, string>, ...names: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !names.includes(name)));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("teacher-web env check (#31)", () => {
  it("accepts a complete production environment", async () => {
    const { checkEnv } = await import("./env");
    expect(checkEnv(full())).toEqual([]);
  });

  it("names every missing always-required variable", async () => {
    const { checkEnv } = await import("./env");
    const env = without(full(), "DATABASE_URL", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "REDIS_URL");
    expect(checkEnv(env)).toEqual([
      "DATABASE_URL is required",
      "JWT_PRIVATE_KEY is required",
      "JWT_PUBLIC_KEY is required",
      "REDIS_URL is required",
    ]);
  });

  it("treats a feature with none of its variables as off, and a half-configured one as an error", async () => {
    const { checkEnv } = await import("./env");
    const off = without(full(), "CASHFREE_ENV", "CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_WS_URL");
    expect(checkEnv(off)).toEqual([]);

    let half = full();
    half = without(half, "CASHFREE_CLIENT_SECRET");
    half = without(half, "LIVEKIT_WS_URL");
    expect(checkEnv(half)).toEqual([
      "Cashfree is partly configured: CASHFREE_CLIENT_SECRET is missing",
      "LiveKit is partly configured: LIVEKIT_WS_URL (or LIVEKIT_URL) is missing",
    ]);
  });

  it("does not need CRON_SECRET (cron runs on student-web)", async () => {
    const { checkEnv } = await import("./env");
    expect(checkEnv(full())).not.toContain("CRON_SECRET is required");
  });

  it("flags half-configured Zoho email and Google sign-in", async () => {
    const { checkEnv } = await import("./env");
    const env = { ...full(), ZOHO_SMTP_HOST: "smtp.example.test", ZOHO_EMAIL: "a@example.test", GOOGLE_CLIENT_ID: "id", ZOHO_SMTP_PORT: "abc" };
    expect(checkEnv(env)).toEqual([
      "ZOHO_SMTP_PORT must be a port number",
      "Zoho email is partly configured: ZOHO_APP_PASSWORD is missing",
      "Google sign-in is partly configured: GOOGLE_CLIENT_SECRET is missing",
    ]);
  });

  it("accepts LIVEKIT_URL as the alias of LIVEKIT_WS_URL", async () => {
    const { checkEnv } = await import("./env");
    let env = full();
    env = without(env, "LIVEKIT_WS_URL");
    env.LIVEKIT_URL = "wss://live.example.test";
    expect(checkEnv(env)).toEqual([]);
  });

  it("requires the chosen storage provider's credentials", async () => {
    const { checkEnv } = await import("./env");
    let s3 = full();
    s3 = without(s3, "STORAGE_SECRET_KEY");
    expect(checkEnv(s3)).toEqual(["STORAGE_PROVIDER=s3 needs STORAGE_SECRET_KEY"]);
    const supabase = { ...full(), STORAGE_PROVIDER: "supabase" };
    expect(checkEnv(supabase)).toEqual(["STORAGE_PROVIDER=supabase needs SUPABASE_URL", "STORAGE_PROVIDER=supabase needs SUPABASE_SERVICE_KEY"]);
  });

  it("rejects malformed values by name, never echoing the value", async () => {
    const { checkEnv } = await import("./env");
    const env = { ...full(), CASHFREE_ENV: "prod", DATABASE_URL: SECRET, REDIS_URL: SECRET, STORAGE_PROVIDER: "ftp" };
    const problems = checkEnv(env);
    expect(problems).toEqual([
      "DATABASE_URL must be a postgres:// or postgresql:// URL",
      "REDIS_URL must be a redis:// or rediss:// URL",
      'CASHFREE_ENV must be "production" or "sandbox"',
      'STORAGE_PROVIDER must be "s3", "supabase" or "local"',
    ]);
    expect(problems.join(" ")).not.toContain(SECRET);
  });

  it("fails the boot in production with every problem listed and no values", async () => {
    const { validateEnvOnBoot } = await import("./env");
    const env = { ...full(), REDIS_URL: "", CASHFREE_ENV: "prod" };
    expect(() => validateEnvOnBoot(env)).toThrow("Invalid environment for teacher-web (2 problems):\n- REDIS_URL is required\n- CASHFREE_ENV must be");
    try { validateEnvOnBoot(env); } catch (error) { expect(String(error)).not.toContain(SECRET); }
  });

  it("only warns in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { validateEnvOnBoot } = await import("./env");
    expect(() => validateEnvOnBoot({ NODE_ENV: "development" })).not.toThrow();
    expect(String(warn.mock.calls[0]?.[0])).toContain("DATABASE_URL is required");
  });

  it("instrumentation register() runs the check on the Node.js runtime and fails the boot", async () => {
    for (const [name, value] of Object.entries({ ...full(), REDIS_URL: "" })) vi.stubEnv(name, value);
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const { register } = await import("./instrumentation");
    await expect(register()).rejects.toThrow("REDIS_URL is required");
  });
});

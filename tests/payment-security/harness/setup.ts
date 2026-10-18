import { vi } from "vitest";
import { createFakeCashfree, TEST_SECRET, type FakeCashfree } from "./fake-cashfree";
import { createFakeDb, InsufficientCoinsError, type FakeDb } from "./fake-db";

/**
 * Shared wiring for payment-security tests.
 *
 * Each test file calls `vi.mock("@repo/database", () => harness.database())`
 * and `vi.mock("@/lib/auth", () => harness.auth())`, then `harness.reset()`
 * in beforeEach. Gateway calls go to the fake Cashfree in sandbox mode only;
 * no test ever sees a real key.
 */

let fakeDb: FakeDb = createFakeDb();
let fakeCashfree: FakeCashfree = createFakeCashfree();
let currentUser: string | null = "student-a";

export const harness = {
  get db() { return fakeDb; },
  get cashfree() { return fakeCashfree; },

  /** Stable module whose members forward to the current fake, so reset() needs no re-mock. */
  database: () => ({
    get db() { return fakeDb.db; },
    credit: (...args: Parameters<FakeDb["module"]["credit"]>) => fakeDb.module.credit(...args),
    adjust: (...args: Parameters<FakeDb["module"]["adjust"]>) => fakeDb.module.adjust(...args),
    InsufficientCoinsError,
  }),

  auth: () => ({
    requireAuth: async (_req: Request, role: string) => {
      if (!currentUser) return { error: new Response(JSON.stringify({ code: "MISSING_TOKEN" }), { status: 401 }) };
      return { user: { sub: currentUser, role, emailVerified: true } };
    },
  }),

  signIn(userId: string | null) { currentUser = userId; },

  reset() {
    fakeDb = createFakeDb();
    fakeCashfree = createFakeCashfree();
    currentUser = "student-a";
    vi.stubEnv("CASHFREE_CLIENT_ID", "test-client-id");
    vi.stubEnv("CASHFREE_CLIENT_SECRET", TEST_SECRET);
    vi.stubEnv("CASHFREE_ENV", "sandbox");
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => fakeCashfree.fetch(input, init));
  },

  teardown() {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  },
};

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://example.test${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

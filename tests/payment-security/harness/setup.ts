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
let currentAdmin: { id: string; permissions: string[] } | null = null;
const alerts: Array<{ url: string; body: Record<string, unknown> }> = [];
let alertStatus = 200;
export const ALERT_URL = "https://alerts.example.test/hook";
const auditEntries: Array<{ adminId: string; action: string; subjectId: string; details?: Record<string, unknown> }> = [];

export const harness = {
  get db() { return fakeDb; },
  get cashfree() { return fakeCashfree; },

  /** Stable module whose members forward to the current fake, so reset() needs no re-mock. */
  database: () => ({
    get db() { return fakeDb.db; },
    credit: (...args: Parameters<FakeDb["module"]["credit"]>) => fakeDb.module.credit(...args),
    adjust: (...args: Parameters<FakeDb["module"]["adjust"]>) => fakeDb.module.adjust(...args),
    getSpendableBalance: (userId: string) => fakeDb.module.getSpendableBalance(userId),
    InsufficientCoinsError,
  }),

  auth: () => ({
    requireAuth: async (_req: Request, role: string) => {
      if (!currentUser) return { error: new Response(JSON.stringify({ code: "MISSING_TOKEN" }), { status: 401 }) };
      return { user: { sub: currentUser, role, emailVerified: true } };
    },
  }),

  signIn(userId: string | null) { currentUser = userId; },

  /** Mirrors admin-panel requireApiAdmin(): 401 without a session, 403 without the permission. */
  adminAuth: () => ({
    requireApiAdmin: async (_req: Request, permission?: string) => {
      if (!currentAdmin) return { ok: false, response: Response.json({ message: "Unauthorized" }, { status: 401 }) };
      if (permission && !currentAdmin.permissions.includes(permission)) return { ok: false, response: Response.json({ message: "Forbidden" }, { status: 403 }) };
      return { ok: true, admin: { id: currentAdmin.id, email: "admin@example.test", name: "Admin", roleKey: "TEST", isSuperAdmin: false, permissions: currentAdmin.permissions } };
    },
  }),
  audit: () => ({
    auditLog: async (ctx: { adminId: string }, action: string, subjectId: string, details?: Record<string, unknown>) => {
      auditEntries.push({ adminId: ctx.adminId, action, subjectId, details });
    },
  }),
  signInAdmin(admin: { id: string; permissions: string[] } | null) { currentAdmin = admin; },
  get auditEntries() { return auditEntries; },
  /** Payloads POSTed to PAYMENT_ALERT_WEBHOOK_URL. */
  get alerts() { return alerts; },
  /** Make the alert endpoint answer with this status (0 = network error). */
  alertEndpointReturns(status: number) { alertStatus = status; },

  reset() {
    fakeDb = createFakeDb();
    fakeCashfree = createFakeCashfree();
    currentUser = "student-a";
    currentAdmin = null;
    auditEntries.length = 0;
    alerts.length = 0;
    alertStatus = 200;
    vi.stubEnv("CASHFREE_CLIENT_ID", "test-client-id");
    vi.stubEnv("CASHFREE_CLIENT_SECRET", TEST_SECRET);
    vi.stubEnv("CASHFREE_ENV", "sandbox");
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      if (String(input).startsWith(ALERT_URL)) {
        if (alertStatus === 0) throw new TypeError("fetch failed");
        alerts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return new Response(null, { status: alertStatus });
      }
      return fakeCashfree.fetch(input, init);
    });
  },

  teardown() {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  },
};

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://example.test${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
}

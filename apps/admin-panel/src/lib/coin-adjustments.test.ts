import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockAdjust, mockVerifyPassword, mockVerifyTotp, mockRateLimit, mockSecurityEvent } = vi.hoisted(() => ({
  mockDb: {
    adminUser: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockAdjust: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockVerifyTotp: vi.fn(),
  mockRateLimit: vi.fn(),
  mockSecurityEvent: vi.fn(),
}));

vi.mock("@repo/database", () => {
  class InsufficientCoinsError extends Error {}
  return {
    db: mockDb,
    adjust: mockAdjust,
    getCoinBalance: vi.fn(async () => ({ balance: 7, heldBalance: 0, totalBalance: 7, lifetimeEarned: 7, lifetimeSpent: 0 })),
    InsufficientCoinsError,
  };
});
vi.mock("./password", () => ({ verifyPassword: mockVerifyPassword }));
vi.mock("./totp", () => ({ verifyTotpCode: mockVerifyTotp }));
vi.mock("./rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("./audit", () => ({ recordSecurityEvent: mockSecurityEvent }));

import { applyCoinAdjustment, coinAdjustmentSchema, adjustmentKey, DAILY_ADJUSTMENT_LIMIT } from "./coin-adjustments";
import { InsufficientCoinsError } from "@repo/database";
import type { SessionUser } from "./rbac";

const admin: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  name: "Admin",
  roleKey: "SUPER_ADMIN",
  isSuperAdmin: true,
  permissions: [],
};
const TARGET = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const meta = { ip: "1.2.3.4", userAgent: "vitest" };

const input = {
  direction: "CREDIT" as const,
  amount: 500,
  reason: "Compensation for cancelled class",
  requestId: REQUEST_ID,
  password: "correct horse",
};

/** A fake interactive transaction. `used` is the admin's 24h adjustment total. */
function fakeTx({ used = 0, existing = false } = {}) {
  return {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(async () => [{ used }]),
    coinTransaction: { findUnique: vi.fn(async () => (existing ? { id: "t" } : null)) },
    adminAuditLog: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
}

let tx: ReturnType<typeof fakeTx>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ ok: true, retryAfterMs: 0 });
  mockVerifyPassword.mockResolvedValue(true);
  mockDb.adminUser.findUnique.mockResolvedValue({ passwordHash: "hash", user: { totpEnabled: false, totpSecret: null } });
  mockDb.user.findUnique.mockResolvedValue({ id: TARGET, email: "s@example.com", role: "STUDENT", adminUser: null });
  tx = fakeTx();
  mockDb.$transaction.mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  mockAdjust.mockResolvedValue({ balance: 1500, heldBalance: 0, totalBalance: 1500, lifetimeEarned: 1500, lifetimeSpent: 0 });
});

describe("coinAdjustmentSchema", () => {
  it("rejects fractional, zero and over-limit amounts", () => {
    for (const amount of [0, 1.5, -5, 10_001]) {
      expect(coinAdjustmentSchema.safeParse({ ...input, amount }).success).toBe(false);
    }
  });

  it("requires a meaningful reason and a uuid request id", () => {
    expect(coinAdjustmentSchema.safeParse({ ...input, reason: "because" }).success).toBe(false);
    expect(coinAdjustmentSchema.safeParse({ ...input, requestId: "abc" }).success).toBe(false);
    expect(coinAdjustmentSchema.safeParse(input).success).toBe(true);
  });
});

describe("applyCoinAdjustment", () => {
  it("credits, audits and notifies inside one transaction", async () => {
    const res = await applyCoinAdjustment(admin, TARGET, input, meta);

    expect(res).toMatchObject({ ok: true, duplicate: false });
    expect(mockAdjust).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TARGET, delta: 500, idempotencyKey: adjustmentKey(admin.id, REQUEST_ID) }),
      tx
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ adminId: admin.id, eventType: "COINS_CREDITED", actorId: TARGET }),
    });
    expect(tx.notification.create).toHaveBeenCalled();
  });

  it("debits with a negative delta", async () => {
    await applyCoinAdjustment(admin, TARGET, { ...input, direction: "DEBIT" }, meta);
    expect(mockAdjust).toHaveBeenCalledWith(expect.objectContaining({ delta: -500 }), tx);
  });

  it("refuses a wrong password and records a security event", async () => {
    mockVerifyPassword.mockResolvedValue(false);
    const res = await applyCoinAdjustment(admin, TARGET, input, meta);
    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(mockSecurityEvent).toHaveBeenCalledWith("COIN_ADJUST_STEPUP_FAILED", "WARN", expect.anything(), admin.id, meta.ip);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("demands a TOTP code when the admin has 2FA", async () => {
    mockDb.adminUser.findUnique.mockResolvedValue({ passwordHash: "h", user: { totpEnabled: true, totpSecret: "s" } });
    expect(await applyCoinAdjustment(admin, TARGET, input, meta)).toMatchObject({ ok: false, code: "TOTP_REQUIRED" });

    mockVerifyTotp.mockResolvedValue(false);
    expect(await applyCoinAdjustment(admin, TARGET, { ...input, totpCode: "000000" }, meta)).toMatchObject({ ok: false, status: 403 });

    mockVerifyTotp.mockResolvedValue(true);
    expect(await applyCoinAdjustment(admin, TARGET, { ...input, totpCode: "123456" }, meta)).toMatchObject({ ok: true });
  });

  it("refuses self-adjustment", async () => {
    const res = await applyCoinAdjustment(admin, admin.id, input, meta);
    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("refuses admin accounts as targets", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: TARGET, email: "a@x.com", role: "ADMIN", adminUser: null });
    expect(await applyCoinAdjustment(admin, TARGET, input, meta)).toMatchObject({ ok: false, status: 403 });

    mockDb.user.findUnique.mockResolvedValue({ id: TARGET, email: "a@x.com", role: "STUDENT", adminUser: { userId: TARGET } });
    expect(await applyCoinAdjustment(admin, TARGET, input, meta)).toMatchObject({ ok: false, status: 403 });
  });

  it("returns 404 for an unknown user", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    expect(await applyCoinAdjustment(admin, TARGET, input, meta)).toMatchObject({ ok: false, status: 404 });
  });

  it("enforces the rolling 24h cap without writing anything", async () => {
    tx = fakeTx({ used: DAILY_ADJUSTMENT_LIMIT - 100 });
    const res = await applyCoinAdjustment(admin, TARGET, input, meta);
    expect(res).toMatchObject({ ok: false, status: 422 });
    expect(mockAdjust).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("treats a replayed request id as a no-op", async () => {
    tx = fakeTx({ existing: true });
    const res = await applyCoinAdjustment(admin, TARGET, input, meta);
    expect(res).toMatchObject({ ok: true, duplicate: true });
    expect(mockAdjust).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("maps insufficient coins to 409", async () => {
    mockAdjust.mockRejectedValue(new InsufficientCoinsError());
    const res = await applyCoinAdjustment(admin, TARGET, { ...input, direction: "DEBIT" }, meta);
    expect(res).toMatchObject({ ok: false, status: 409 });
  });

  it("stops when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ ok: false, retryAfterMs: 1000 });
    expect(await applyCoinAdjustment(admin, TARGET, input, meta)).toMatchObject({ ok: false, status: 429 });
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("raises a security event for large adjustments", async () => {
    await applyCoinAdjustment(admin, TARGET, { ...input, amount: 6000 }, meta);
    expect(mockSecurityEvent).toHaveBeenCalledWith("LARGE_COIN_ADJUSTMENT", "WARN", expect.anything(), admin.id, meta.ip);
  });
});

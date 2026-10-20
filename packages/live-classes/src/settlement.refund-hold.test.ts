/**
 * What `refundSessionHold` does to a student's wallet.
 *
 * This is the function both cancel paths lean on — `cancelBookingAndReturnCoins`
 * calls it for each held session when a student cancels, and the admin
 * "Cancel Session" action calls it directly — but until now nothing asserted
 * what it leaves behind. The two callers could only be tested by delegation:
 * "it calls the shared function". This says what the shared function is worth.
 *
 * Like `coin-ledger.invariants.test.ts`, it does not touch Postgres. The one
 * statement inside `releaseHold` is modelled as an in-memory transition —
 * `balance += amount, heldBalance -= amount`, skipped when the idempotency key
 * has already been applied — which is the same shape the real UPDATE has. What
 * that leaves unproven is Postgres itself: the `heldBalance >= amount` guard
 * and the uniqueness of the idempotency key are the database's job, not this
 * file's.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const HELD_COINS = 500;
const SESSION = "5e551011-0000-4000-8000-000000000001";
const STUDENT = "11111111-1111-4111-8111-111111111111";

type Billing = {
  classSessionId: string;
  studentId: string;
  heldCoins: number;
  status: string;
  refundedCoins: number;
  reason: string | null;
  settledAt: Date | null;
};

const state = vi.hoisted(() => ({
  /** The student's wallet before anything is released. */
  wallet: { balance: 0, heldBalance: 0 },
  /** Idempotency keys the ledger has already seen. */
  applied: new Set<string>(),
  billing: null as Billing | null,
  releaseCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@repo/database", () => ({
  db: {},
  hold: vi.fn(),
  refund: vi.fn(),
  captureHold: vi.fn(),
  // The in-memory stand-in for releaseHold's single UPDATE.
  releaseHold: async (params: Record<string, unknown>) => {
    state.releaseCalls.push(params);
    const key = params.idempotencyKey as string;
    if (state.applied.has(key)) return;
    state.applied.add(key);
    const amount = params.amount as number;
    state.wallet.balance += amount;
    state.wallet.heldBalance -= amount;
  },
}));

/** Just enough of Prisma for refundSessionHold's two queries. */
const tx = {
  sessionBilling: {
    findUnique: async ({ where }: { where: { classSessionId: string } }) =>
      state.billing && state.billing.classSessionId === where.classSessionId ? state.billing : null,
    update: async ({ data }: { data: Partial<Billing> }) => {
      Object.assign(state.billing!, data);
      return state.billing;
    },
  },
};

beforeEach(() => {
  // The student paid 500 coins into a hold when they booked: those coins have
  // left `balance` and are sitting in `heldBalance`.
  state.wallet = { balance: 1_000, heldBalance: HELD_COINS };
  state.applied.clear();
  state.releaseCalls.length = 0;
  state.billing = {
    classSessionId: SESSION,
    studentId: STUDENT,
    heldCoins: HELD_COINS,
    status: "HELD",
    refundedCoins: 0,
    reason: null,
    settledAt: null,
  };
});

const release = async (reason = "Class cancelled by an administrator") => {
  const { refundSessionHold } = await import("./settlement");
  await refundSessionHold(SESSION, reason, tx as never);
};

describe("refundSessionHold", () => {
  it("puts the held coins back into the spendable balance", async () => {
    await release();

    expect(state.wallet.balance).toBe(1_500);
  });

  it("leaves no hold behind", async () => {
    await release();

    expect(state.wallet.heldBalance).toBe(0);
  });

  it("moves coins, rather than creating them: the wallet total is unchanged", async () => {
    const before = state.wallet.balance + state.wallet.heldBalance;

    await release();

    expect(state.wallet.balance + state.wallet.heldBalance).toBe(before);
  });

  it("releases exactly what was held, for the student who held it", async () => {
    await release();

    expect(state.releaseCalls).toHaveLength(1);
    expect(state.releaseCalls[0]).toMatchObject({
      userId: STUDENT,
      amount: HELD_COINS,
      classSessionId: SESSION,
      idempotencyKey: `refund:${SESSION}`,
    });
  });

  it("marks the billing row REFUNDED, so the class is not billed later", async () => {
    await release();

    expect(state.billing).toMatchObject({
      status: "REFUNDED",
      refundedCoins: HELD_COINS,
      reason: "Class cancelled by an administrator",
    });
    expect(state.billing!.settledAt).toBeInstanceOf(Date);
  });

  it("is idempotent: a second call pays nothing out again", async () => {
    await release();
    const afterFirst = { ...state.wallet };

    await release();

    expect(state.wallet).toEqual(afterFirst);
    // The billing row is no longer HELD, so the ledger is never reached twice.
    expect(state.releaseCalls).toHaveLength(1);
  });

  it("would still refuse a second payout even if the billing row said HELD", async () => {
    // Belt and braces: the short-circuit above is the first guard, the
    // idempotency key is the second. This removes the first to prove the
    // second carries its own weight.
    await release();
    state.billing!.status = "HELD";

    await release();

    expect(state.wallet).toEqual({ balance: 1_500, heldBalance: 0 });
    expect(state.releaseCalls).toHaveLength(2);
  });

  it("does nothing for a session that was already charged", async () => {
    state.billing!.status = "CHARGED";

    await release();

    expect(state.wallet).toEqual({ balance: 1_000, heldBalance: HELD_COINS });
    expect(state.releaseCalls).toHaveLength(0);
  });

  it("does nothing for a session that has no billing row at all", async () => {
    state.billing = null;

    await release();

    expect(state.wallet).toEqual({ balance: 1_000, heldBalance: HELD_COINS });
    expect(state.releaseCalls).toHaveLength(0);
  });
});

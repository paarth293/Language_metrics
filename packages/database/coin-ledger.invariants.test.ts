/**
 * Ledger invariant tests.
 *
 * These do not touch Postgres. They model each SQL statement in coin-ledger.ts
 * as an in-memory transition and then hammer random operation sequences at it,
 * asserting the two invariants that must never break:
 *
 *   I1. balance === sum of every ledger row's signed amount
 *   I2. balance >= 0 and heldBalance >= 0
 *
 * I1 is the one that matters. An earlier draft of captureHold() wrote
 * `SPEND -charge` alone, which charges the student once at hold and again at
 * capture. The balance still looked plausible; only the ledger sum diverged.
 * This test fails loudly on that mistake, which is why it exists.
 *
 * Run: npx tsx --test packages/database/coin-ledger.invariants.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Type = "PURCHASE" | "BONUS" | "SPEND" | "REFUND" | "HOLD" | "HOLD_RELEASE" | "ADJUSTMENT";
interface Row { type: Type; amount: number }

/** Mirrors the UPDATE statements in coin-ledger.ts, one method per function. */
class LedgerModel {
  balance = 0;
  heldBalance = 0;
  lifetimeEarned = 0;
  lifetimeSpent = 0;
  rows: Row[] = [];

  credit(amount: number): boolean {
    if (amount <= 0) return false;
    this.balance += amount;
    this.lifetimeEarned += amount;
    this.rows.push({ type: "PURCHASE", amount });
    return true;
  }

  debit(amount: number): boolean {
    if (amount <= 0 || this.balance < amount) return false; // WHERE balance >= amount
    this.balance -= amount;
    this.lifetimeSpent += amount;
    this.rows.push({ type: "SPEND", amount: -amount });
    return true;
  }

  hold(amount: number): boolean {
    if (amount <= 0 || this.balance < amount) return false;
    this.balance -= amount;
    this.heldBalance += amount;
    this.rows.push({ type: "HOLD", amount: -amount });
    return true;
  }

  releaseHold(amount: number): boolean {
    if (amount <= 0 || this.heldBalance < amount) return false;
    this.balance += amount;
    this.heldBalance -= amount;
    this.rows.push({ type: "HOLD_RELEASE", amount });
    return true;
  }

  captureHold(heldAmount: number, chargeAmount: number): boolean {
    if (chargeAmount > heldAmount) return false;
    if (this.heldBalance < heldAmount) return false;
    const refund = heldAmount - chargeAmount;
    this.heldBalance -= heldAmount;
    this.balance += refund;
    this.lifetimeSpent += chargeAmount;
    if (heldAmount > 0) this.rows.push({ type: "HOLD_RELEASE", amount: heldAmount });
    if (chargeAmount > 0) this.rows.push({ type: "SPEND", amount: -chargeAmount });
    return true;
  }

  ledgerSum(): number {
    return this.rows.reduce((a, r) => a + r.amount, 0);
  }

  check(label: string) {
    assert.equal(this.balance, this.ledgerSum(), `I1 broken after ${label}`);
    assert.ok(this.balance >= 0, `I2: negative balance after ${label}`);
    assert.ok(this.heldBalance >= 0, `I2: negative hold after ${label}`);
  }
}

describe("ledger invariants — worked example", () => {
  it("keeps balance equal to the ledger sum through a full class lifecycle", () => {
    const m = new LedgerModel();

    m.credit(100);
    m.check("credit 100");
    assert.equal(m.balance, 100);

    m.hold(60);
    m.check("hold 60");
    assert.equal(m.balance, 40, "held coins leave spendable");
    assert.equal(m.heldBalance, 60);

    // Student attended 25 of the 60 booked minutes at 1 coin/min.
    m.captureHold(60, 25);
    m.check("capture 25 of 60");
    assert.equal(m.heldBalance, 0, "hold must be fully consumed");
    assert.equal(m.balance, 75, "100 - 25 charged = 75");
    assert.equal(m.lifetimeSpent, 25);
  });

  it("detects the double-charge bug the naive implementation has", () => {
    // The naive capture: write only `SPEND -charge` and skip the release row.
    const naive = new LedgerModel();
    naive.credit(100);
    naive.hold(60);
    naive.heldBalance -= 60;
    naive.balance += 35;
    naive.rows.push({ type: "SPEND", amount: -25 }); // the bug
    assert.notEqual(
      naive.balance,
      naive.ledgerSum(),
      "this arrangement must break I1 — that is the whole point of the release row"
    );
    // The drift is the ENTIRE hold, because the missing HOLD_RELEASE row is
    // what should have put those 60 coins back into the ledger's reckoning.
    // From the student's side the effect is that the 25 they were charged is
    // subtracted twice over: once by the HOLD row, once by the SPEND row.
    assert.equal(naive.balance - naive.ledgerSum(), 60, "drift equals the unreleased hold");
  });
});

describe("ledger invariants — randomised", () => {
  it("holds across 20k random operations", () => {
    // Deterministic PRNG so a failure is reproducible.
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >> 17;
      seed ^= seed << 5;  seed >>>= 0;
      return seed / 0x100000000;
    };
    const pick = (n: number) => Math.floor(rnd() * n);

    const m = new LedgerModel();
    const openHolds: number[] = [];

    for (let i = 0; i < 20_000; i++) {
      switch (pick(5)) {
        case 0:
          m.credit(1 + pick(500));
          break;
        case 1:
          m.debit(1 + pick(200));
          break;
        case 2: {
          const amount = 1 + pick(200);
          if (m.hold(amount)) openHolds.push(amount);
          break;
        }
        case 3: {
          if (openHolds.length === 0) break;
          const idx = pick(openHolds.length);
          const amount = openHolds[idx]!;
          if (m.releaseHold(amount)) openHolds.splice(idx, 1);
          break;
        }
        case 4: {
          if (openHolds.length === 0) break;
          const idx = pick(openHolds.length);
          const held = openHolds[idx]!;
          const charge = pick(held + 1);
          if (m.captureHold(held, charge)) openHolds.splice(idx, 1);
          break;
        }
      }
      m.check(`op ${i}`);
    }

    // Settle everything that is still open and confirm nothing is stranded.
    for (const held of openHolds) m.captureHold(held, 0);
    m.check("final settle");
    assert.equal(m.heldBalance, 0, "no coins may be stranded in holds");
    assert.equal(m.balance, m.ledgerSum());
  });

  it("never lets a debit or hold overdraw", () => {
    const m = new LedgerModel();
    m.credit(10);
    assert.equal(m.debit(11), false, "overdraw must be rejected, not clamped");
    assert.equal(m.hold(11), false);
    assert.equal(m.balance, 10);
    assert.equal(m.releaseHold(1), false, "cannot release a hold that does not exist");
  });
});

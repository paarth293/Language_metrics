import { describe, it, expect } from "vitest";
import type { Tx } from "@repo/database";
import { bookingWasNeverPaid } from "./settlement";

const t0 = new Date("2026-09-01T10:00:00Z").getTime();
const at = (ms: number) => new Date(t0 + ms);

interface FakeBooking {
  id: string;
  studentId: string;
  amountPaid: number;
  createdAt: Date;
  sessions: { id: string }[];
}
interface FakeTxn {
  id: string;
  type: string;
  amount: number;
  createdAt: Date;
  description?: string;
  idempotencyKey?: string;
  classSessionId?: string;
}

/** Just enough of Prisma for wasSpentAtBooking's three queries. */
function fakeTx(bookings: FakeBooking[], txns: FakeTxn[]): Tx {
  const inRange = (d: Date, r: { gte: Date; lte: Date }) => d >= r.gte && d <= r.lte;
  return {
    coinTransaction: {
      findMany: async ({ where }: any) =>
        txns.filter((t) =>
          where.type === "HOLD"
            ? t.type === "HOLD" && where.idempotencyKey.in.includes(t.idempotencyKey)
            : t.type === "SPEND" &&
              inRange(t.createdAt, where.createdAt) &&
              ["Booked class with", "1-on-1 Class with"].some((p) => t.description?.startsWith(p))
        ),
    },
    booking: {
      findMany: async ({ where }: any) =>
        bookings.filter((b) => b.studentId === where.studentId && inRange(b.createdAt, where.createdAt)),
    },
  } as unknown as Tx;
}

const booking = (id: string, ms: number, amountPaid = 100): FakeBooking => ({
  id,
  studentId: "stu",
  amountPaid,
  createdAt: at(ms),
  sessions: [{ id: `${id}-s` }],
});
const spend = (id: string, ms: number, amount = -100): FakeTxn => ({
  id,
  type: "SPEND",
  amount,
  createdAt: at(ms),
  description: "Booked class with Teacher",
});

describe("bookingWasNeverPaid pairing", () => {
  it("treats a booking with its own SPEND as paid", async () => {
    const a = booking("a", 0);
    expect(await bookingWasNeverPaid(a, fakeTx([a], [spend("sa", 5)]))).toBe(false);
  });

  it("does not let a nearby unpaid booking borrow a paid one's SPEND", async () => {
    const a = booking("a", 0);
    const b = booking("b", 20_000);
    const tx = fakeTx([a, b], [spend("sa", 5)]);
    expect(await bookingWasNeverPaid(a, tx)).toBe(false);
    expect(await bookingWasNeverPaid(b, tx)).toBe(true);
  });

  it("keeps the pairing after the paid booking settles", async () => {
    // Settlement rewrites amountPaid and adds a billing row; neither may
    // release A's SPEND to B.
    const a = { ...booking("a", 0), amountPaid: 40 };
    const b = booking("b", 20_000);
    expect(await bookingWasNeverPaid(b, fakeTx([a, b], [spend("sa", 5)]))).toBe(true);
  });

  it("ignores held bookings, which wrote no SPEND", async () => {
    const held = booking("h", 20_002); // closer to sb than b is
    const b = booking("b", 20_000);
    const hold: FakeTxn = {
      id: "hh",
      type: "HOLD",
      amount: -100,
      createdAt: at(20_002),
      idempotencyKey: "hold:h-s",
      classSessionId: "h-s",
    };
    expect(await bookingWasNeverPaid(b, fakeTx([held, b], [spend("sb", 20_004), hold]))).toBe(false);
  });

  it("is unpaid when the nearest SPEND has a different price", async () => {
    const a = booking("a", 0);
    expect(await bookingWasNeverPaid(a, fakeTx([a], [spend("sa", 5, -250)]))).toBe(true);
  });
});

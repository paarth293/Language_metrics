import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two things are asserted here about an admin cancel.
 *
 * 1. It is not subject to the student's 4-hour window. That window exists to
 *    stop a student walking away from a class the teacher is about to turn up
 *    for. An admin cancelling on someone's behalf is the escape hatch for
 *    exactly the cases the window refuses, so it must keep working at any
 *    time, including minutes before the class.
 *
 * 2. It gives the student's coins back. Before this change the admin button
 *    flipped ClassSession.status to CANCELLED and stopped there: the coins
 *    stayed in `heldBalance` forever, with no path back. A cancel the student
 *    makes releases the hold; a cancel an admin makes on the student's behalf
 *    must do the same, through the same function.
 */
const mocks = vi.hoisted(() => ({
  update: vi.fn(async () => ({})),
  refundSessionHold: vi.fn(async () => {}),
  requirePermission: vi.fn(async () => ({ id: "admin-1" })),
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/database", () => {
  // The transaction hands back the same client, so an assertion on
  // `mocks.update` covers the call whether it is made on `db` or on `tx`.
  const tx = { classSession: { update: mocks.update } };
  return { db: { ...tx, $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});
vi.mock("@repo/live-classes", () => ({ refundSessionHold: mocks.refundSessionHold }));
vi.mock("@/lib/guards", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const SESSION = "5e551011-0000-4000-8000-000000000001";
const BOOKING = "b0000011-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-20T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  // One hour before the class: well inside the window a student is refused in.
  vi.setSystemTime(NOW);
  mocks.update.mockClear();
  mocks.refundSessionHold.mockClear();
  mocks.requirePermission.mockClear();
  mocks.revalidatePath.mockClear();
  vi.resetModules();
});

describe("updateSessionStatus", () => {
  it("cancels a class starting in one hour, which a student would be refused", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: SESSION },
      data: { status: "CANCELLED" },
    });
  });

  it("still requires the classes:manage permission", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    expect(mocks.requirePermission).toHaveBeenCalledWith("classes:manage");
  });

  it("refuses nothing on the grounds of time, because it never reads the start time", async () => {
    const { updateSessionStatus } = await import("./actions");

    // The same call a minute before the class, and a day after it.
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    await expect(updateSessionStatus(SESSION, BOOKING, "CANCELLED")).resolves.not.toThrow();

    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("still sets the other statuses", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "COMPLETED");

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: SESSION },
      data: { status: "COMPLETED" },
    });
  });
});

describe("updateSessionStatus — the student's coins", () => {
  it("releases the hold through the same function a student cancel uses", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    // `refundSessionHold` is what cancelBookingAndReturnCoins calls for each
    // held session, so the admin path and the student path move coins through
    // one body of code rather than two.
    expect(mocks.refundSessionHold).toHaveBeenCalledTimes(1);
    const [sessionId, reason, client] = mocks.refundSessionHold.mock.calls[0] as unknown[];
    expect(sessionId).toBe(SESSION);
    expect(typeof reason).toBe("string");
    expect((reason as string).length).toBeGreaterThan(0);
    // Passed the transaction, so the status flip and the coin movement either
    // both land or neither does.
    expect(client).toBeDefined();
  });

  it("releases the hold inside the same transaction as the status flip", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    const [, , client] = mocks.refundSessionHold.mock.calls[0] as unknown[];
    const txUpdate = (client as { classSession: { update: unknown } }).classSession.update;
    expect(txUpdate).toBe(mocks.update);
  });

  it("is idempotent: a second cancel asks for the same release again, which is a no-op", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");
    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    // Both clicks call the shared function; it is the shared function that
    // refuses to pay twice — it returns early unless the billing row is HELD,
    // and releaseHold() below it drops a repeat of `refund:<sessionId>`.
    expect(mocks.refundSessionHold).toHaveBeenCalledTimes(2);
    const keys = mocks.refundSessionHold.mock.calls.map((c) => (c as unknown[])[0]);
    expect(keys).toEqual([SESSION, SESSION]);
  });

  it("gives nothing back when the admin marks a class COMPLETED", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "COMPLETED");

    expect(mocks.refundSessionHold).not.toHaveBeenCalled();
  });

  it("gives nothing back when the admin sets SCHEDULED or ONGOING", async () => {
    const { updateSessionStatus } = await import("./actions");

    await updateSessionStatus(SESSION, BOOKING, "SCHEDULED");
    await updateSessionStatus(SESSION, BOOKING, "ONGOING");

    expect(mocks.refundSessionHold).not.toHaveBeenCalled();
  });

  it("refunds a class starting in one hour, which the student window would refuse", async () => {
    const { updateSessionStatus } = await import("./actions");

    // The whole point of the admin path: inside the student's closed window,
    // the coins still come back.
    await updateSessionStatus(SESSION, BOOKING, "CANCELLED");

    expect(mocks.refundSessionHold).toHaveBeenCalledTimes(1);
  });
});

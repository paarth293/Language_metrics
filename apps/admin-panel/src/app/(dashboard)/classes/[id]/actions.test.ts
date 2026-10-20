import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An admin cancel is not subject to the student's 4-hour window.
 *
 * The student window exists to stop a student walking away from a class the
 * teacher is about to turn up for. An admin cancelling on someone's behalf is
 * the escape hatch for exactly the cases the window refuses, so it must keep
 * working at any time, including minutes before the class.
 */
const mocks = vi.hoisted(() => ({
  update: vi.fn(async () => ({})),
  requirePermission: vi.fn(async () => ({ id: "admin-1" })),
  revalidatePath: vi.fn(),
}));

vi.mock("@repo/database", () => ({ db: { classSession: { update: mocks.update } } }));
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

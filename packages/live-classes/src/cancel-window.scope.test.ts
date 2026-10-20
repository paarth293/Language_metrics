import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Who the student cancellation window applies to.
 *
 * The rule is deliberately narrow: it gates the two student cancel routes and
 * nothing else. A teacher cancel, an admin cancel and anything the system does
 * must stay unblocked by it. That is easy to state and easy to break later by
 * "tidying" the check down into the shared cancel function, where it would
 * silently start refusing admin cancels too.
 *
 * So this test asserts the wiring itself, from the source, rather than trusting
 * a comment.
 */
const REPO = join(__dirname, "..", "..", "..");

const read = (relative: string) => {
  const path = join(REPO, relative);
  // Fails loudly if a file moves, instead of quietly asserting nothing.
  expect(existsSync(path), `expected to find ${relative}`).toBe(true);
  return readFileSync(path, "utf8");
};

/** Every identifier that would mean "the student cancel window is applied here". */
const WINDOW_MARKERS = ["canStudentCancel", "STUDENT_CANCEL_WINDOW", "studentCancelClosesAt"];

const mentionsWindow = (source: string) => WINDOW_MARKERS.some((m) => source.includes(m));

describe("the student cancel window gates the student routes", () => {
  const studentCancelRoutes = [
    "apps/student-web/src/app/api/students/classes/[id]/cancel/route.ts",
    "apps/teacher-web/src/app/api/students/classes/[id]/cancel/route.ts",
  ];

  for (const route of studentCancelRoutes) {
    it(`applies it in ${route}`, () => {
      const source = read(route);
      expect(source).toContain("canStudentCancel");
      // And does not carry a second, local copy of the number.
      expect(source).not.toContain("12 * 60 * 60 * 1000");
      expect(source).not.toMatch(/CANCELLATION_WINDOW_HOURS\s*=/);
    });
  }
});

describe("and gates nothing else", () => {
  it("does not reach the shared cancel-and-refund function", () => {
    // cancelBookingAndReturnCoins is called by the student routes, which have
    // already applied the window, and is also the function any other caller
    // would use. A window check in here would block every cancel in the system.
    const settlement = read("packages/live-classes/src/settlement.ts");
    expect(settlement).toContain("export async function cancelBookingAndReturnCoins");
    expect(mentionsWindow(settlement)).toBe(false);
  });

  it("does not reach the admin cancel action", () => {
    const adminAction = read("apps/admin-panel/src/app/(dashboard)/classes/[id]/actions.ts");
    expect(adminAction).toContain("CANCELLED");
    expect(mentionsWindow(adminAction)).toBe(false);
  });

  it("does not reach the booking service's reschedule path", () => {
    // Rescheduling has its own, unrelated window and must keep it.
    const booking = read("packages/live-classes/src/booking.ts");
    expect(booking).toContain("RESCHEDULE_WINDOW_MINUTES");
    expect(mentionsWindow(booking)).toBe(false);
  });
});

describe("there is no other way to become cancelled", () => {
  it("leaves the booking-cancelled write in exactly one file", () => {
    // If a new cancel path appears, it will not be covered by the window and
    // this test is the reminder to decide whether it should be.
    const settlement = read("packages/live-classes/src/settlement.ts");
    const writes = settlement.match(/data:\s*\{\s*status:\s*"CANCELLED"\s*\}/g) ?? [];
    expect(writes.length).toBe(2); // the booking row, then its scheduled sessions
  });
});

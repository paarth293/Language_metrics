// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ScheduleSession } from "./schedule-utils";
import { SessionRow } from "./SessionRow";

/**
 * Where a teacher reaches the cancel.
 *
 * `SessionRow` is shared by the schedule's list, the week view's day agenda
 * and the dashboard's "next classes" strip. Only the first two hand it an
 * `onCancelled` callback, because only they sit on a page that can reload the
 * week afterwards. Without that callback the row shows no cancel at all, so
 * the dashboard is unchanged by this.
 */
const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

vi.mock("@/lib/fetch-with-refresh", () => ({ fetchWithRefresh: vi.fn() }));

const session = (overrides: Partial<ScheduleSession> = {}): ScheduleSession => {
  const start = new Date(NOW.getTime() + 24 * HOUR);
  return {
    id: "5e551011-0000-4000-8000-000000000001",
    status: "SCHEDULED",
    scheduledStart: start.toISOString(),
    scheduledEnd: new Date(start.getTime() + HOUR).toISOString(),
    booking: { id: "b1b1b1b1-0000-4000-8000-000000000001", status: "CONFIRMED", type: "HOURLY" },
    student: {
      userId: "11111111-1111-4111-8111-111111111111",
      name: "Aiko Tanaka",
      avatarUrl: null,
      proficiencyLevel: "B1",
    },
    ...overrides,
  };
};

const cancelButton = () => screen.queryByRole("button", { name: /^cancel class$/i });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SessionRow — the cancel affordance", () => {
  it("offers a cancel on an upcoming class when the page can handle it", () => {
    render(<SessionRow session={session()} now={NOW.getTime()} onCancelled={vi.fn()} />);

    expect(cancelButton()).not.toBeNull();
  });

  it("offers none when no page is listening", () => {
    render(<SessionRow session={session()} now={NOW.getTime()} />);

    expect(cancelButton()).toBeNull();
  });

  it("offers none on a cancelled class", () => {
    render(
      <SessionRow session={session({ status: "CANCELLED" })} now={NOW.getTime()} onCancelled={vi.fn()} />
    );

    expect(cancelButton()).toBeNull();
  });

  it("still shows the student and the time alongside it", () => {
    render(<SessionRow session={session()} now={NOW.getTime()} onCancelled={vi.fn()} />);

    expect(screen.getByText("Aiko Tanaka")).toBeTruthy();
    expect(cancelButton()).not.toBeNull();
  });

  it("offers a cancel twenty minutes before the class, which a student could not", () => {
    const start = new Date(NOW.getTime() + 20 * 60_000);
    render(
      <SessionRow
        session={session({
          scheduledStart: start.toISOString(),
          scheduledEnd: new Date(start.getTime() + HOUR).toISOString(),
        })}
        now={NOW.getTime()}
        onCancelled={vi.fn()}
      />
    );

    expect(cancelButton()).not.toBeNull();
  });
});

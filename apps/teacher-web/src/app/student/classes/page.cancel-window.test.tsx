// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  STUDENT_CANCEL_WINDOW_MS,
  STUDENT_CANCEL_WINDOW_NOTE,
} from "@repo/live-classes/cancel-window";
import ClassesPage from "./page";

const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

/**
 * One upcoming booking whose class starts `hours` from now, carrying the
 * server-computed deadline exactly as /api/students/classes sends it.
 */
const bookingStartingIn = (hours: number) => {
  const start = new Date(NOW.getTime() + hours * HOUR);
  return {
    id: "b0000011-0000-4000-8000-000000000001",
    teacher: "Aiko Tanaka",
    avatar: null,
    language: "Japanese",
    type: "HOURLY",
    status: "CONFIRMED",
    totalSessions: 1,
    completedSessions: 0,
    cancelClosesAt: new Date(start.getTime() - STUDENT_CANCEL_WINDOW_MS).toISOString(),
    nextSession: {
      id: "5e551011-0000-4000-8000-000000000001",
      scheduledStart: start.toISOString(),
      scheduledEnd: new Date(start.getTime() + HOUR).toISOString(),
      status: "SCHEDULED",
      joinOpensAt: new Date(start.getTime() - 10 * 60_000).toISOString(),
      joinClosesAt: new Date(start.getTime() + HOUR + 10 * 60_000).toISOString(),
    },
    endedSession: null,
    review: null,
    amountPaid: 500,
    scheduledStart: start.toISOString(),
    createdAt: NOW.toISOString(),
  };
};

const renderWith = async (hours: number) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ bookings: [bookingStartingIn(hours)] }),
    }))
  );
  render(<ClassesPage />);
  await screen.findByText(/Aiko Tanaka/);
  // Anchored: an unanchored /Cancel/i also matches the "cancelled" tab button.
  // Asserted through the native property, as in student-web.
  return screen.getByRole("button", { name: /^Cancel$/ }) as HTMLButtonElement;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("leaves Cancel enabled when the class is more than four hours away", async () => {
  const button = await renderWith(5);
  expect(button.disabled).toBe(false);
});

/**
 * The exact boundary — a class exactly four hours out, and one millisecond
 * inside — is asserted against a frozen clock in cancel-window.test.ts and in
 * the cancel route's own test. It is deliberately not asserted here: this test
 * needs `shouldAdvanceTime` so React's async queries can settle, which moves
 * the clock a few milliseconds while the component renders, and a millisecond
 * either side of the boundary would make the result a coin toss. What this file
 * proves is that the UI follows the deadline the server sent.
 */
it("leaves Cancel enabled just outside the window", async () => {
  const button = await renderWith(4 + 1 / 60);
  expect(button.disabled).toBe(false);
});

it("disables Cancel inside the last four hours", async () => {
  const button = await renderWith(3);
  expect(button.disabled).toBe(true);
});

it("disables Cancel once the class has started", async () => {
  const button = await renderWith(-1);
  expect(button.disabled).toBe(true);
});

it("tells the student when cancellation closes", async () => {
  await renderWith(3);
  expect(await screen.findByText(STUDENT_CANCEL_WINDOW_NOTE)).toBeTruthy();
});

it("shows the same note while cancelling is still allowed", async () => {
  await renderWith(24);
  expect(await screen.findByText(STUDENT_CANCEL_WINDOW_NOTE)).toBeTruthy();
});

it("no longer promises a twelve-hour window anywhere on the page", async () => {
  await renderWith(24);
  expect(screen.queryByText(/12h before class/i)).toBeNull();
});

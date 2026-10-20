// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ScheduleSession } from "./schedule-utils";
import { CancelClassButton } from "./CancelClassButton";

/**
 * The confirm step in front of a teacher cancel.
 *
 * Cancelling is not undoable from the teacher's side — the class is gone, the
 * student's hold is released and the student has been told — so the button on
 * its own is not enough. Nothing may be sent until the teacher has read what
 * is about to happen and said yes to it.
 *
 * The fixed clock keeps "twenty minutes before the class" meaning the same
 * thing on every machine.
 */
const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const SESSION = "5e551011-0000-4000-8000-000000000001";
const CANCEL_URL = `/api/teachers/sessions/${SESSION}/cancel`;

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fetch-with-refresh", () => ({ fetchWithRefresh: fetchMock }));

const session = (overrides: Partial<ScheduleSession> = {}): ScheduleSession => {
  const start = new Date(NOW.getTime() + 24 * HOUR);
  return {
    id: SESSION,
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

const ok = (body: unknown = { success: true, refunded: true }) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

/** Renders, and returns the spy the component calls once a cancel lands. */
const setup = (s: ScheduleSession = session()) => {
  const onCancelled = vi.fn();
  render(<CancelClassButton session={s} onCancelled={onCancelled} />);
  return { onCancelled };
};

const trigger = () => screen.queryByRole("button", { name: /^cancel class$/i });
const confirmButton = () => screen.getByRole("button", { name: /^yes, cancel/i }) as HTMLButtonElement;

const openDialog = () => {
  fireEvent.click(trigger()!);
  return screen.getByRole("dialog");
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CancelClassButton — nothing is sent without a yes", () => {
  it("sends nothing when the button is clicked", () => {
    setup();

    openDialog();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for confirmation in a labelled modal dialog", () => {
    setup();

    const dialog = openDialog();

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("says who is affected, what happens to their coins, and that they are told", () => {
    setup();

    const dialog = openDialog();

    expect(dialog.textContent).toMatch(/Aiko Tanaka/);
    expect(dialog.textContent).toMatch(/coin/i);
    expect(dialog.textContent).toMatch(/notified|told/i);
  });

  it("sends nothing when the teacher backs out", async () => {
    const { onCancelled } = setup();

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: /keep class/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCancelled).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends nothing when the teacher presses Escape", async () => {
    setup();

    openDialog();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("CancelClassButton — on a yes", () => {
  it("posts to this session's cancel endpoint", async () => {
    setup();

    openDialog();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(CANCEL_URL);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("tells the page, so the schedule can reload", async () => {
    const { onCancelled } = setup();

    openDialog();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
  });

  it("posts once, however many times the confirm button is hit", async () => {
    // A slow network is the usual way a double cancel gets sent. The server
    // would refuse the second one, but the UI should not be asking.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    setup();

    openDialog();
    const confirm = confirmButton();
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables the confirm button while the request is in flight", async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    setup();

    openDialog();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(confirmButton().disabled).toBe(true));
  });
});

describe("CancelClassButton — when the server says no", () => {
  it("shows the server's reason and does not claim success", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Class is already cancelled" }),
    });
    const { onCancelled } = setup();

    openDialog();
    fireEvent.click(confirmButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already cancelled/i);
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("survives a network failure with a readable message", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { onCancelled } = setup();

    openDialog();
    fireEvent.click(confirmButton());

    const alert = await screen.findByRole("alert");
    // Whatever went wrong, the teacher is not shown a raw Error.
    expect(alert.textContent).not.toMatch(/offline/);
    expect(alert.textContent!.length).toBeGreaterThan(0);
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("lets the teacher try again after a failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(ok());
    const { onCancelled } = setup();

    openDialog();
    fireEvent.click(confirmButton());
    await screen.findByRole("alert");

    fireEvent.click(confirmButton());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("CancelClassButton — when there is nothing to cancel", () => {
  it("offers nothing for a class that is already cancelled", () => {
    setup(session({ status: "CANCELLED" }));

    expect(trigger()).toBeNull();
  });

  it("offers nothing for a completed class", () => {
    setup(session({ status: "COMPLETED" }));

    expect(trigger()).toBeNull();
  });

  it("offers nothing for a class whose booking is cancelled", () => {
    setup(session({ booking: { id: "b", status: "CANCELLED", type: "HOURLY" } }));

    expect(trigger()).toBeNull();
  });

  it("offers nothing once the class has started", () => {
    const start = new Date(NOW.getTime() - HOUR);
    setup(
      session({
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(start.getTime() + HOUR).toISOString(),
      })
    );

    expect(trigger()).toBeNull();
  });

  it("still offers a cancel twenty minutes before the class", () => {
    // Inside the student's closed window, which does not apply to a teacher.
    const start = new Date(NOW.getTime() + 20 * 60_000);
    setup(
      session({
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(start.getTime() + HOUR).toISOString(),
      })
    );

    expect(trigger()).not.toBeNull();
  });
});

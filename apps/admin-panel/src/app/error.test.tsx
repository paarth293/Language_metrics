// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// #8f: the admin-panel error page (it had none). It must offer a retry,
// report to Sentry when it is on, and never show the raw error text.
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

beforeEach(() => sentry.captureException.mockReset());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const failure = Object.assign(new Error("connect ECONNREFUSED postgresql://app:pw@db.internal"), { digest: "4089123456" });

describe("admin-panel error.tsx (#8f)", () => {
  it("shows a generic message with a retry and the digest, not the error text", async () => {
    const { default: AdminError } = await import("./error");
    const reset = vi.fn();
    render(<AdminError error={failure} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeTruthy();
    expect(screen.getByText("4089123456")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/ECONNREFUSED|postgresql/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports the error to Sentry when NEXT_PUBLIC_SENTRY_DSN is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.example.test/1");
    const { default: AdminError } = await import("./error");
    render(<AdminError error={failure} reset={() => {}} />);
    await waitFor(() => expect(sentry.captureException).toHaveBeenCalledWith(failure));
  });

  it("does not load Sentry when no DSN is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const { default: AdminError } = await import("./error");
    render(<AdminError error={failure} reset={() => {}} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import TeacherRegisterPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-client", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/image", () => ({
  default: () => <div data-testid="mock-image" />,
}));

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("TeacherRegisterPage - Email Availability Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows 'This email address is already registered...' when check-email reports duplicate after entering email", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/check-email")) {
        return jsonResponse({
          available: false,
          code: "EMAIL_ALREADY_EXISTS",
          message:
            "This email address is already registered. Please use another email address or sign in to your existing account.",
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherRegisterPage />);

    const emailInput = screen.getByLabelText(/email address/i);

    // Enter email
    fireEvent.change(emailInput, { target: { value: "alreadyregistered@example.com" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      const errorMsg = screen.getByRole("alert");
      expect(errorMsg.textContent).toBe(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/check-email?email=alreadyregistered%40example.com"),
      expect.any(Object)
    );
  });

  it("checks availability automatically via debounce while typing without requiring blur", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/check-email")) {
        return jsonResponse({
          available: false,
          code: "EMAIL_ALREADY_EXISTS",
          message:
            "This email address is already registered. Please use another email address or sign in to your existing account.",
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherRegisterPage />);

    const emailInput = screen.getByPlaceholderText(/enter your email/i);

    // Typing a valid email without blurring
    fireEvent.change(emailInput, { target: { value: "duplicate@example.com" } });

    // Before debounce timer expires, no fetch call
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance debounce timer (400ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/check-email?email=duplicate%40example.com"),
      expect.any(Object)
    );

    expect(
      screen.getByText(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      )
    ).not.toBeNull();

    vi.useRealTimers();
  });

  it("clears error message when user changes the email input", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/check-email")) {
        return jsonResponse({
          available: false,
          code: "EMAIL_ALREADY_EXISTS",
          message:
            "This email address is already registered. Please use another email address or sign in to your existing account.",
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherRegisterPage />);

    const emailInput = screen.getByLabelText(/email address/i);

    fireEvent.change(emailInput, { target: { value: "taken@example.com" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(
        screen.getByText(
          "This email address is already registered. Please use another email address or sign in to your existing account."
        )
      ).not.toBeNull();
    });

    // User types something else
    fireEvent.change(emailInput, { target: { value: "different@example.com" } });

    expect(
      screen.queryByText(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      )
    ).toBeNull();
  });

  it("blocks proceeding to OTP / step 2 when email is already registered", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/check-email")) {
        return jsonResponse({
          available: false,
          code: "EMAIL_ALREADY_EXISTS",
          message:
            "This email address is already registered. Please use another email address or sign in to your existing account.",
        });
      }
      if (url.includes("/api/auth/send-registration-otp")) {
        return jsonResponse({ message: "Verification code sent." });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherRegisterPage />);

    const nameInput = screen.getByPlaceholderText(/enter your full name/i);
    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/create a password/i);

    fireEvent.change(nameInput, { target: { value: "Jane Teacher" } });
    fireEvent.change(emailInput, { target: { value: "taken@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "SecurePassword123!" } });

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "This email address is already registered. Please use another email address or sign in to your existing account."
        )
      ).not.toBeNull();
    });

    // send-registration-otp should NOT have been called
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/api/auth/send-registration-otp"))
    ).toBe(false);
  });
});

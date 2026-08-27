import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginForm from "./login-form";
import * as React from "react";

// Mock React
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useActionState: vi.fn(),
  };
});

// Mock React DOM status
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useFormStatus: () => ({ pending: false }),
  };
});

describe("LoginForm Component", () => {
  const mockFormAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(React.useActionState).mockImplementation(() => [
      null, // state
      mockFormAction, // formAction
      false, // isPending
    ]);
  });

  it("renders email and password fields initially", () => {
    render(<LoginForm csrfToken="token" />);
    
    expect(screen.getByLabelText(/Admin email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Two-factor code/i)).not.toBeInTheDocument();
  });

  it("shows error message on invalid credentials", () => {
    vi.mocked(React.useActionState).mockImplementation(() => [
      { error: "Invalid credentials" },
      mockFormAction,
      false,
    ]);

    render(<LoginForm csrfToken="token" />);
    
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("transitions to 2FA step when 2FA_REQUIRED is returned", () => {
    vi.mocked(React.useActionState).mockImplementation(() => [
      { error: "2FA_REQUIRED", email: "test@example.com", password: "password" },
      mockFormAction,
      false,
    ]);

    render(<LoginForm csrfToken="token" />);
    
    // Original inputs should be hidden (not accessible by label)
    expect(screen.queryByLabelText(/Admin email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Password$/)).not.toBeInTheDocument();
    
    // TOTP input should be visible
    expect(screen.getByLabelText(/Two-factor code/i)).toBeInTheDocument();
    
    // Hidden inputs should exist with preserved state
    const hiddenEmail = document.querySelector('input[name="email"][type="hidden"]') as HTMLInputElement;
    const hiddenPassword = document.querySelector('input[name="password"][type="hidden"]') as HTMLInputElement;
    
    expect(hiddenEmail).not.toBeNull();
    expect(hiddenEmail.value).toBe("test@example.com");
    
    expect(hiddenPassword).not.toBeNull();
    expect(hiddenPassword.value).toBe("password");
  });

  it("disables submit button while pending", () => {
    vi.mocked(React.useActionState).mockImplementation(() => [
      null,
      mockFormAction,
      true, // isPending = true
    ]);

    render(<LoginForm csrfToken="token" />);
    
    const button = screen.getByRole("button", { name: /Authenticating/i });
    expect(button).toBeDisabled();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginForm from "./login-form";
import * as React from "react";

// Mock React
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    useActionState: vi.fn(),
  };
});

// Mock React DOM status
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
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

  // Fix (errors.md #N3): this test previously asserted the OLD, insecure
  // design — that the real email/password inputs unmount and get replaced
  // by `<input type="hidden">` fields whose values come back through the
  // server action's return state. login-form.tsx was deliberately changed
  // away from that (see the comment above the form in login-form.tsx): a
  // password once put in `LoginState` would round-trip through the RSC
  // payload and land in a `type="hidden"` DOM node — i.e. genuinely exposed
  // to anything that can read the page, not just "hidden" in the visual
  // sense. The fix keeps the ORIGINAL password/email inputs mounted and
  // merely CSS-hides their wrapping <div> (Tailwind's `hidden` class) so the
  // browser resubmits whatever the user already typed, with no secret ever
  // passing back through server-action state. `LoginState` (see actions.ts)
  // now only carries `{ error, email }` — never a password — so this test
  // is updated to verify THAT contract instead of the one that was
  // intentionally removed.
  it("transitions to 2FA step when 2FA_REQUIRED is returned", () => {
    vi.mocked(React.useActionState).mockImplementation(() => [
      { error: "2FA_REQUIRED", email: "test@example.com" },
      mockFormAction,
      false,
    ]);

    render(<LoginForm csrfToken="token" />);

    // The original email/password inputs must still be present in the DOM
    // (same nodes the user typed into — only their wrapping <div> is
    // CSS-hidden, they are never unmounted or replaced).
    const emailInput = document.getElementById("admin-email") as HTMLInputElement;
    const passwordInput = document.getElementById("admin-password") as HTMLInputElement;
    expect(emailInput).not.toBeNull();
    expect(emailInput.type).toBe("email");
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.type).toBe("password");

    // Their wrapping containers carry the "hidden" class once 2FA is
    // required. The email input's immediate parent is the hidden wrapper;
    // the password input is nested one level deeper (inside a
    // `.relative` wrapper for the show/hide button), so its hidden
    // ancestor is one level further up.
    expect(emailInput.closest("div")).toHaveClass("hidden");
    expect(passwordInput.closest("div.relative")?.parentElement).toHaveClass("hidden");

    // Neither field is ever rendered as type="hidden" — a plaintext password
    // must never be echoed into the DOM via server-action state.
    expect(document.querySelector('input[name="email"][type="hidden"]')).toBeNull();
    expect(document.querySelector('input[name="password"][type="hidden"]')).toBeNull();

    // TOTP input should be visible, required, and the email should be
    // echoed back as plain confirmation text (never the password).
    const totpInput = screen.getByLabelText(/Two-factor code/i);
    expect(totpInput).toBeInTheDocument();
    expect(totpInput).toBeRequired();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
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

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { PasswordInput } from "./PasswordInput";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("reveals and hides the same value without submitting its form", () => {
    const submit = vi.fn((event) => event.preventDefault());
    const ref = createRef<HTMLInputElement>();
    render(<form onSubmit={submit}>
      <label htmlFor="password">Password</label>
      <PasswordInput id="password" ref={ref} defaultValue="Example123!" autoComplete="new-password" />
    </form>);
    const field = screen.getByLabelText("Password") as HTMLInputElement;
    expect(field.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field.type).toBe("text");
    expect(field.value).toBe("Example123!");
    expect(ref.current).toBe(field);
    expect(field.autocomplete).toBe("new-password");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field.type).toBe("password");
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps disabled passwords concealed and preserves validation attributes", () => {
    render(<PasswordInput disabled aria-label="Password" aria-invalid="true" aria-describedby="error" />);
    const field = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field.type).toBe("password");
    expect(field.disabled).toBe(true);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe("error");
  });
});

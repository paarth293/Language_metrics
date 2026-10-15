import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

afterEach(cleanup);

it("prevents clicks while loading even when disabled=false is passed", () => {
  const click = vi.fn();
  render(<Button isLoading disabled={false} onClick={click}>Save</Button>);
  const button = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
});

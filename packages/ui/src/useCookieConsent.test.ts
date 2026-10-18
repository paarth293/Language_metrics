import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCookieConsent } from "./useCookieConsent";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("allows declining when the browser blocks local storage", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Storage blocked", "SecurityError"); });
  const { result } = renderHook(useCookieConsent);
  expect(result.current.visible).toBe(true);
  act(() => result.current.choose("declined"));
  expect(result.current.visible).toBe(false);
});

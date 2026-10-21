import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { __resetCacheForTests, clearCache, setCacheOwner } from "./resource-cache";
import { useStickyState } from "./useStickyState";

function Tabs({ name = "sessions:tab" }: { name?: string }) {
  const [tab, setTab] = useStickyState(name, "upcoming");
  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <button type="button" onClick={() => setTab("past")}>Past</button>
    </div>
  );
}

beforeEach(__resetCacheForTests);
afterEach(cleanup);

describe("useStickyState", () => {
  it("starts from the initial value", () => {
    render(<Tabs />);
    expect(screen.getByTestId("tab").textContent).toBe("upcoming");
  });

  it("keeps the selection across a remount, the way a navigation does", () => {
    const view = render(<Tabs />);
    act(() => { screen.getByRole("button", { name: "Past" }).click(); });
    expect(screen.getByTestId("tab").textContent).toBe("past");
    view.unmount();

    render(<Tabs />);
    expect(screen.getByTestId("tab").textContent).toBe("past");
  });

  it("keys are independent", () => {
    render(<div><Tabs name="a" /><Tabs name="b" /></div>);
    const [first, second] = screen.getAllByTestId("tab");
    act(() => { screen.getAllByRole("button", { name: "Past" })[0]!.click(); });
    expect(first!.textContent).toBe("past");
    expect(second!.textContent).toBe("upcoming");
  });

  it("is discarded on logout", () => {
    const view = render(<Tabs />);
    act(() => { screen.getByRole("button", { name: "Past" }).click(); });
    view.unmount();
    clearCache();

    render(<Tabs />);
    expect(screen.getByTestId("tab").textContent).toBe("upcoming");
  });

  it("is discarded when the account changes", () => {
    setCacheOwner("user-1");
    const view = render(<Tabs />);
    act(() => { screen.getByRole("button", { name: "Past" }).click(); });
    view.unmount();
    setCacheOwner("user-2");

    render(<Tabs />);
    expect(screen.getByTestId("tab").textContent).toBe("upcoming");
  });
});

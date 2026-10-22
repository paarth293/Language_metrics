// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChatPage from "./page";
import { PortalProvider } from "@repo/student-portal";

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("discards a slow response from the previous conversation", async () => {
  let resolveFirst!: (value: unknown) => void;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  const thread = (id: string, name: string) => ({ teacherId: id, teacherName: name, teacherAvatar: null, lastMessage: "", lastMessageTime: new Date().toISOString(), unreadCount: 0, language: "English" });
  const message = (content: string) => ({ id: content, senderId: "teacher", content, attachmentUrl: null, autoDeleteAt: "2099-01-01", createdAt: new Date().toISOString() });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/students/chat") return { ok: true, json: async () => ({ threads: [thread("a", "Alice"), thread("b", "Bob")] }) };
    if (url.endsWith("/a")) return first;
    return { ok: true, json: async () => ({ messages: [message("Bob message")] }) };
  }));
  render(
    <PortalProvider basePath="">
      <ChatPage />
    </PortalProvider>
  );
  fireEvent.click(await screen.findByRole("button", { name: /Alice/ }));
  fireEvent.click(screen.getByRole("button", { name: /Bob/ }));
  expect(await screen.findByText("Bob message")).toBeTruthy();
  await act(async () => { resolveFirst({ ok: true, json: async () => ({ messages: [message("Alice message")] }) }); });
  expect(screen.queryByText("Alice message")).toBeNull();
  expect(screen.getByText("Bob message")).toBeTruthy();
});

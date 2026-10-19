// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChatPage from "./page";

const THREADS_URL = "/api/students/chat";
const MESSAGES_URL = "/api/students/chat/a";
const T0 = Date.parse("2026-10-19T10:00:00.000Z");

type Msg = { id: string; senderId: string; content: string; attachmentUrl: null; autoDeleteAt: string; createdAt: string };
const msg = (n: number, at = T0 + n * 1000): Msg => ({
  id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
  senderId: "a",
  content: `m${n}`,
  attachmentUrl: null,
  autoDeleteAt: "2099-01-01",
  createdAt: new Date(at).toISOString(),
});

let calls: string[] = [];
let firstPage: { messages: Msg[]; hasMore?: boolean };
let pollReply: { messages: Msg[] } = { messages: [] };
let olderReply: { messages: Msg[]; hasMore?: boolean } = { messages: [] };

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const messageGets = () => calls.filter((u) => u.startsWith(MESSAGES_URL));
const threadGets = () => calls.filter((u) => u === THREADS_URL);
const shown = () => screen.queryAllByText(/^m\d+$/).map((el) => el.textContent);

async function openConversation() {
  render(<ChatPage />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(T0 + 3_600_000);
  Element.prototype.scrollIntoView = vi.fn();
  setVisibility("visible");
  calls = [];
  firstPage = { messages: [msg(1)], hasMore: false };
  pollReply = { messages: [] };
  olderReply = { messages: [] };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    if (url === THREADS_URL) {
      return { ok: true, json: async () => ({ threads: [{ teacherId: "a", teacherName: "Alice", teacherAvatar: null, lastMessage: "", lastMessageTime: new Date(T0).toISOString(), unreadCount: 0, language: "English" }] }) };
    }
    if (url === MESSAGES_URL) return { ok: true, json: async () => firstPage };
    if (url.startsWith(`${MESSAGES_URL}?after=`)) return { ok: true, json: async () => pollReply };
    if (url.startsWith(`${MESSAGES_URL}?before=`)) return { ok: true, json: async () => olderReply };
    return { ok: false, json: async () => ({}) };
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("chat page polling", () => {
  it("polls an open conversation every 10 s, asking only for newer messages", async () => {
    await openConversation();
    const before = messageGets().length;
    await flush(60_000);
    const polls = messageGets().slice(before);
    expect(polls).toHaveLength(6);
    expect(polls.every((u) => u.startsWith(`${MESSAGES_URL}?after=`))).toBe(true);
  });

  it("looks back 10 s from the newest message it has", async () => {
    await openConversation();
    await flush(10_000);
    const poll = messageGets().at(-1)!;
    expect(new URL(poll, "http://x").searchParams.get("after")).toBe(new Date(T0 + 1000 - 10_000).toISOString());
  });

  it("polls the thread list every 30 s", async () => {
    await openConversation();
    const before = threadGets().length;
    await flush(60_000);
    expect(threadGets().length - before).toBe(2);
  });

  it("stops polling while the tab is hidden and polls once immediately when it is visible again", async () => {
    await openConversation();
    setVisibility("hidden");
    const before = messageGets().length;
    const threadsBefore = threadGets().length;
    await flush(60_000);
    expect(messageGets().length).toBe(before);
    expect(threadGets().length).toBe(threadsBefore);

    setVisibility("visible");
    await flush();
    expect(messageGets().length).toBe(before + 1);
    expect(threadGets().length).toBe(threadsBefore + 1);
  });

  it("slows to 30 s after 2 minutes with no new messages", async () => {
    await openConversation();
    await flush(150_000);
    const before = messageGets().length;
    await flush(120_000);
    expect(messageGets().length - before).toBe(4);
  });

  it("merges polled messages by id, without duplicates, in time order", async () => {
    await openConversation();
    pollReply = { messages: [msg(3), msg(1), msg(2)] };
    await flush(10_000);
    expect(shown()).toEqual(["m1", "m2", "m3"]);
  });

  it("loads older messages above the current ones", async () => {
    firstPage = { messages: [msg(50), msg(51)], hasMore: true };
    olderReply = { messages: [msg(48), msg(49)], hasMore: false };
    await openConversation();
    fireEvent.click(screen.getByRole("button", { name: /load older messages/i }));
    await flush();
    const older = calls.find((u) => u.startsWith(`${MESSAGES_URL}?before=`))!;
    const params = new URL(older, "http://x").searchParams;
    expect(params.get("before")).toBe(msg(50).createdAt);
    expect(params.get("beforeId")).toBe(msg(50).id);
    expect(shown()).toEqual(["m48", "m49", "m50", "m51"]);
    expect(screen.queryByRole("button", { name: /load older messages/i })).toBeNull();
  });
});

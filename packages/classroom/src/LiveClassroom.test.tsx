import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import LiveClassroom from "./LiveClassroom";

const mocks = vi.hoisted(() => ({ stop: vi.fn(), disconnect: vi.fn(), fetch: vi.fn(), send: vi.fn(), receive: undefined as undefined | ((message: { payload: Uint8Array; from: { identity: string; name: string } }) => void) }));

vi.mock("./hooks/usePrejoinDevices", () => ({
  usePrejoinDevices: () => ({
    ready: true, cameraEnabled: false, micEnabled: true, micLevel: 0,
    attachVideo: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(), stop: mocks.stop,
  }),
}));

vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  RoomAudioRenderer: () => null,
  VideoTrack: () => <video />,
  useConnectionState: () => "connected",
  useRoomContext: () => ({ disconnect: mocks.disconnect }),
  useTracks: () => [],
  useParticipants: () => [],
  useLocalParticipant: () => ({ localParticipant: { identity: "self" }, isMicrophoneEnabled: true, isCameraEnabled: false }),
  useDataChannel: (_topic: string, receive: typeof mocks.receive) => {
    mocks.receive = receive;
    return { send: mocks.send };
  },
}));

beforeEach(() => { Element.prototype.scrollTo = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const grant = {
  token: "test-token", serverUrl: "wss://example.invalid", profile: "low",
  participantName: "Learner", otherPartyName: "Tutor", coinsPerMinute: 1,
  scheduledEnd: "2099-01-01T00:00:00Z", hardEndsAt: "2099-01-01T00:05:00Z",
  recordingEnabled: true,
};

describe("shared classroom integration", () => {
  it.each(["STUDENT", "TEACHER"])("preserves prejoin and role-specific controls for %s", async (role) => {
    mocks.fetch.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => url === "/api/live/token" ? { ...grant, role } : { billableMinutes: 0, coinsSoFar: 0 },
    }));
    vi.stubGlobal("fetch", mocks.fetch);
    render(<LiveClassroom classSessionId="session-1" exitHref="/classes" />);
    expect(mocks.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    await screen.findByRole("button", { name: "Mute microphone" });
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/live/token", expect.objectContaining({
      method: "POST", credentials: "include", body: JSON.stringify({ classSessionId: "session-1", profile: "low" }),
    }));
    if (role === "TEACHER") {
      expect(screen.getByRole("button", { name: "End class" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Share your screen" })).toBeTruthy();
    } else {
      expect(screen.getByRole("button", { name: "Leave class" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "End class" })).toBeNull();
    }
  });

  it("shows the server rejection and retains the caller's return URL", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({ code: "SESSION_CANCELLED", message: "Booking cancelled" }) });
    vi.stubGlobal("fetch", mocks.fetch);
    render(<LiveClassroom classSessionId="cancelled" exitHref="/teacher/sessions" />);
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    await waitFor(() => expect(screen.getByText("Booking cancelled")).toBeTruthy());
    expect(screen.getByRole("link", { name: "Back to classes" }).getAttribute("href")).toBe("/teacher/sessions");
    expect(screen.queryByRole("button", { name: "Mute microphone" })).toBeNull();
  });

  it("joins the room when retrying after an initial rejection", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ code: "NETWORK", message: "Try later" }) });
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...grant, role: "TEACHER" }) });
    vi.stubGlobal("fetch", mocks.fetch);
    render(<LiveClassroom classSessionId="retry" exitHref="/classes" />);
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "End class" })).toBeTruthy();
  });

  it("receives chat while closed and retains it when reopened", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...grant, role: "TEACHER" }) });
    vi.stubGlobal("fetch", mocks.fetch);
    render(<LiveClassroom classSessionId="chat" exitHref="/classes" />);
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    const toggle = await screen.findByRole("button", { name: "Toggle chat" });
    act(() => mocks.receive?.({ payload: new TextEncoder().encode(JSON.stringify({ text: "Hello", sender: "Spoofed" })), from: { identity: "student", name: "Student" } }));
    expect(toggle.textContent).toContain("1");
    fireEvent.click(toggle);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.queryByText(/Spoofed/)).toBeNull();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("keeps the teacher in the classroom when ending the class fails", async () => {
    mocks.fetch.mockImplementation(async (url: string) => ({ ok: !url.endsWith("/end"), json: async () => ({ ...grant, role: "TEACHER" }) }));
    vi.stubGlobal("fetch", mocks.fetch);
    render(<LiveClassroom classSessionId="end" exitHref="/classes" />);
    fireEvent.click(screen.getByRole("button", { name: "Join class" }));
    fireEvent.click(await screen.findByRole("button", { name: "End class" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });
});

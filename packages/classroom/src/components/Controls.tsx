"use client";

import { useCallback, useState } from "react";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { Circle, MessageSquare, Mic, MicOff, MonitorUp, Phone, Settings2, Video, VideoOff } from "lucide-react";
import { QUALITY_PROFILES } from "@repo/livekit/client";
import type { TokenResponse } from "../types";

export function Controls({
  grant,
  classSessionId,
  chatOpen,
  unread,
  onToggleChat,
  onLeave,
}: {
  grant: TokenResponse;
  classSessionId: string;
  chatOpen: boolean;
  unread: number;
  onToggleChat: () => void;
  onLeave: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const participants = useParticipants();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = grant.role === "TEACHER";
  const audioOnly = QUALITY_PROFILES[grant.profile].audioOnly;

  const toggleRecording = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/${classSessionId}/recording`, {
        method: recording ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: recording ? undefined : JSON.stringify({ mode: "audio" }),
      });
      if (!res.ok) throw new Error("Recording could not be updated. Please try again.");
      setRecording((v) => !v);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recording could not be updated.");
    } finally {
      setBusy(false);
    }
  }, [classSessionId, recording]);

  const endClass = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/${classSessionId}/end`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("The class could not be ended. Please try again.");
      onLeave();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The class could not be ended.");
    } finally {
      setBusy(false);
    }
  }, [classSessionId, onLeave]);

  const btn = (active: boolean) =>
    `p-3 rounded-xl transition-all ${
      active ? "bg-surface-inset text-text hover:bg-border" : "bg-red-500/10 text-red-500"
    }`;

  return (
    <>
    {error && <p role="alert" className="px-4 py-2 text-center text-sm text-danger bg-surface">{error}</p>}
    <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-4 border-t border-border bg-surface">
      <button
        type="button"
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        aria-pressed={isMicrophoneEnabled}
        className={btn(isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      {!audioOnly && (
        <button
          type="button"
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          aria-label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
          aria-pressed={isCameraEnabled}
          className={btn(isCameraEnabled)}
        >
          {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>
      )}

      {isTeacher && (
        <button
          type="button"
          onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
          aria-label="Share your screen"
          aria-pressed={isScreenShareEnabled}
          className={`p-3 rounded-xl transition-all ${
            isScreenShareEnabled
              ? "bg-brand/10 text-brand"
              : "bg-surface-inset text-text hover:bg-border"
          }`}
        >
          <MonitorUp className="w-5 h-5" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleChat}
        aria-label="Toggle chat"
        aria-pressed={chatOpen}
        className={`relative p-3 rounded-xl transition-all ${
          chatOpen ? "bg-brand/10 text-brand" : "bg-surface-inset text-text hover:bg-border"
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        {unread > 0 && !chatOpen && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isTeacher && grant.recordingEnabled && (
        <button
          type="button"
          onClick={toggleRecording}
          disabled={busy}
          aria-label={recording ? "Stop recording" : "Start recording"}
          aria-pressed={recording}
          title="Records audio only — cheaper to store and all a language class needs"
          className={`p-3 rounded-xl transition-all disabled:opacity-50 ${
            recording ? "bg-red-500/10 text-red-500" : "bg-surface-inset text-text hover:bg-border"
          }`}
        >
          <Circle className={`w-5 h-5 ${recording ? "fill-current" : ""}`} />
        </button>
      )}

      <span className="hidden sm:inline-flex items-center gap-1.5 px-2 text-xs text-text-subtle">
        <Settings2 className="w-3.5 h-3.5" />
        {QUALITY_PROFILES[grant.profile].label} · {participants.length} in room
      </span>

      {isTeacher ? (
        <button
          type="button"
          onClick={endClass}
          disabled={busy}
          className="ml-2 sm:ml-4 px-4 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-all"
        >
          End class
        </button>
      ) : (
        <button
          type="button"
          onClick={onLeave}
          aria-label="Leave class"
          className="ml-2 sm:ml-4 p-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
        >
          <Phone className="w-5 h-5 rotate-[135deg]" />
        </button>
      )}
    </div>
    </>
  );
}

"use client";

/**
 * LiveClassroom — the real thing.
 *
 * Replaces the placeholder that showed "Waiting for teacher to join..." over
 * a static gradient and a chat panel whose messages went nowhere.
 *
 * Flow:
 *   1. Prejoin. Camera and mic are previewed LOCALLY — no room connection, no
 *      billable minutes — until the user presses Join.
 *   2. Connect. Token is fetched, the room is joined, the meter starts.
 *   3. In class. Video, screen share, real chat over the data channel, a live
 *      cost meter, and a countdown to the hard cutoff.
 *   4. Leave. Disconnect immediately so minutes stop accruing.
 *
 * Used by both the student and teacher apps. The server decides the role from
 * the booking, so this component does not need two versions.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import {
  ArrowLeft,
  Circle,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  Send,
  Settings2,
  Video,
  VideoOff,
  WifiOff,
} from "lucide-react";

import { QUALITY_PROFILES, buildConnectOptions, buildRoomOptions } from "@repo/livekit/client";
import type { QualityProfileId } from "@repo/livekit";

import { usePrejoinDevices } from "./usePrejoinDevices";

// ── Types ───────────────────────────────────────────────────────────────────

interface TokenResponse {
  token: string;
  serverUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  role: "TEACHER" | "STUDENT" | "ADMIN";
  profile: QualityProfileId;
  otherPartyName: string;
  scheduledStart: string;
  scheduledEnd: string;
  hardEndsAt: string;
  coinsPerMinute: number;
  heldCoins: number;
  recordingEnabled: boolean;
}

interface TokenError {
  code: string;
  message: string;
  joinOpensAt?: string;
}

interface Meter {
  billableMinutes: number;
  coinsPerMinute: number;
  coinsSoFar: number;
  heldCoins: number;
  projectedRefund: number;
  settled: boolean;
}

interface ChatEntry {
  id: string;
  sender: string;
  text: string;
  at: number;
  self: boolean;
}

export interface LiveClassroomProps {
  classSessionId: string;
  /** Where the Back and Leave buttons go. */
  exitHref: string;
  /** Optional: skip the prejoin screen (used by the admin observer view). */
  autoJoin?: boolean;
}

// ── Root ────────────────────────────────────────────────────────────────────

export default function LiveClassroom({
  classSessionId,
  exitHref,
  autoJoin = false,
}: LiveClassroomProps) {
  const [grant, setGrant] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<TokenError | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [profile, setProfile] = useState<QualityProfileId>("low");

  const requestToken = useCallback(
    async (requested: QualityProfileId) => {
      setConnecting(true);
      setError(null);
      try {
        const res = await fetch("/api/live/token", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classSessionId, profile: requested }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data as TokenError);
          return null;
        }
        setGrant(data as TokenResponse);
        setProfile((data as TokenResponse).profile);
        return data as TokenResponse;
      } catch {
        setError({ code: "NETWORK", message: "Could not reach the server. Check your connection." });
        return null;
      } finally {
        setConnecting(false);
      }
    },
    [classSessionId]
  );

  useEffect(() => {
    if (autoJoin) {
      void requestToken("low").then((g) => {
        if (g) setJoined(true);
      });
    }
  }, [autoJoin, requestToken]);

  if (error && !joined) {
    return <JoinBlocked error={error} exitHref={exitHref} onRetry={() => requestToken(profile)} />;
  }

  if (!joined) {
    return (
      <Prejoin
        classSessionId={classSessionId}
        exitHref={exitHref}
        profile={profile}
        onProfileChange={setProfile}
        connecting={connecting}
        onJoin={async () => {
          const g = await requestToken(profile);
          if (g) setJoined(true);
        }}
      />
    );
  }

  if (!grant) return <FullscreenSpinner label="Preparing your classroom…" />;

  return (
    <LiveKitRoom
      token={grant.token}
      serverUrl={grant.serverUrl}
      connect
      audio
      video={QUALITY_PROFILES[grant.profile].audioOnly ? false : true}
      options={buildRoomOptions(grant.profile)}
      connectOptions={buildConnectOptions()}
      onDisconnected={() => setJoined(false)}
      onError={(e) => setError({ code: "ROOM", message: e.message })}
      className="flex flex-col h-[calc(100dvh-72px)] bg-bg"
    >
      <ClassroomShell grant={grant} exitHref={exitHref} classSessionId={classSessionId} />
      {/* Renders every remote audio track. Without this, nobody hears anyone. */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

// ── Prejoin ─────────────────────────────────────────────────────────────────

function Prejoin({
  exitHref,
  profile,
  onProfileChange,
  connecting,
  onJoin,
}: {
  classSessionId: string;
  exitHref: string;
  profile: QualityProfileId;
  onProfileChange: (p: QualityProfileId) => void;
  connecting: boolean;
  onJoin: () => void;
}) {
  const preset = QUALITY_PROFILES[profile];
  const devices = usePrejoinDevices({
    width: preset.width || 640,
    height: preset.height || 360,
    audioOnly: preset.audioOnly,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    devices.attachVideo(videoRef.current);
  }, [devices]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
          <div className="relative aspect-video bg-surface-inset flex items-center justify-center">
            {devices.cameraEnabled && devices.videoTrack ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="text-center text-text-muted">
                <VideoOff className="w-10 h-10 mx-auto mb-2 opacity-60" />
                <p className="text-sm">
                  {preset.audioOnly ? "Audio-only class" : "Your camera is off"}
                </p>
              </div>
            )}

            {!devices.ready && (
              <div className="absolute inset-0 grid place-items-center bg-surface-inset/80">
                <Loader2 className="w-6 h-6 animate-spin text-brand" />
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {devices.error && (
              <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
                {devices.error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={devices.toggleMic}
                aria-pressed={devices.micEnabled}
                className={`p-3 rounded-xl transition-all ${
                  devices.micEnabled
                    ? "bg-surface-inset text-text hover:bg-border"
                    : "bg-red-500/10 text-red-500"
                }`}
              >
                {devices.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {!preset.audioOnly && (
                <button
                  type="button"
                  onClick={devices.toggleCamera}
                  aria-pressed={devices.cameraEnabled}
                  className={`p-3 rounded-xl transition-all ${
                    devices.cameraEnabled
                      ? "bg-surface-inset text-text hover:bg-border"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {devices.cameraEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Mic level. A dead microphone should be discovered here, not
                  four minutes into a lesson the student is paying for. */}
              <div className="flex-1 h-2 rounded-full bg-surface-inset overflow-hidden">
                <div
                  className="h-full bg-brand transition-[width] duration-75"
                  style={{ width: `${Math.round(devices.micLevel * 100)}%` }}
                />
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-text-muted">Video quality</span>
              <select
                value={profile}
                onChange={(e) => onProfileChange(e.target.value as QualityProfileId)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-surface-inset text-sm text-text focus:outline-none focus:border-brand"
              >
                {Object.values(QUALITY_PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-text-subtle">
                Data saver works well on mobile data and is easier on slow connections.
              </span>
            </label>

            <div className="flex items-center gap-3 pt-1">
              <a
                href={exitHref}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-text-muted hover:text-text transition-colors"
              >
                Cancel
              </a>
              <button
                type="button"
                onClick={() => {
                  // Hand the hardware back before connecting, so the room
                  // opens its own tracks cleanly rather than fighting the
                  // preview for the camera.
                  devices.stop();
                  onJoin();
                }}
                disabled={connecting || !devices.ready}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-hover disabled:opacity-60 transition-all"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {connecting ? "Joining…" : "Join class"}
              </button>
            </div>

            <p className="text-xs text-text-subtle text-center">
              You are not charged until the class begins — billing starts when you and
              your teacher are both in the room.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── In-class shell ──────────────────────────────────────────────────────────

function ClassroomShell({
  grant,
  exitHref,
  classSessionId,
}: {
  grant: TokenResponse;
  exitHref: string;
  classSessionId: string;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const leave = useCallback(async () => {
    // Disconnect explicitly. Minutes stop the moment the socket closes, so
    // leaving properly is worth doing rather than relying on page unload.
    await room.disconnect();
    window.location.href = exitHref;
  }, [room, exitHref]);

  return (
    <>
      <TopBar
        grant={grant}
        connectionState={connectionState}
        classSessionId={classSessionId}
        exitHref={exitHref}
      />

      <div className="flex flex-1 overflow-hidden">
        <Stage otherPartyName={grant.otherPartyName} />
        {chatOpen && (
          <ChatPanel
            selfName={grant.participantName}
            onRead={() => setUnread(0)}
            onIncoming={() => setUnread((n) => n + 1)}
          />
        )}
      </div>

      <Controls
        grant={grant}
        classSessionId={classSessionId}
        chatOpen={chatOpen}
        unread={unread}
        onToggleChat={() => {
          setChatOpen((v) => !v);
          setUnread(0);
        }}
        onLeave={leave}
      />
    </>
  );
}

function TopBar({
  grant,
  connectionState,
  classSessionId,
  exitHref,
}: {
  grant: TokenResponse;
  connectionState: ConnectionState;
  classSessionId: string;
  exitHref: string;
}) {
  const reconnecting =
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface">
      <div className="flex items-center gap-3 min-w-0">
        <a href={exitHref} className="text-text-muted hover:text-text transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text truncate">{grant.otherPartyName}</h2>
          <p className="text-xs text-text-muted truncate">
            {grant.role === "TEACHER" ? "Your student" : "Your teacher"} · Live session
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {grant.role === "STUDENT" && (
          <BillingMeter classSessionId={classSessionId} coinsPerMinute={grant.coinsPerMinute} />
        )}
        <Countdown hardEndsAt={grant.hardEndsAt} scheduledEnd={grant.scheduledEnd} />
        {reconnecting ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
            <WifiOff className="w-3.5 h-3.5" />
            Reconnecting
          </span>
        ) : connectionState === ConnectionState.Connected ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-500">LIVE</span>
          </span>
        ) : (
          <span className="text-xs font-medium text-text-muted">Connecting…</span>
        )}
      </div>
    </div>
  );
}

/**
 * The running cost, shown to the student during class.
 *
 * Polled from the server rather than counted in the browser, because the
 * server's number is the one that settles. A client-side timer would drift
 * and then disagree with the receipt, which reads as a billing error even
 * when the charge is correct.
 */
function BillingMeter({
  classSessionId,
  coinsPerMinute,
}: {
  classSessionId: string;
  coinsPerMinute: number;
}) {
  const [meter, setMeter] = useState<Meter | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/${classSessionId}/meter`, { credentials: "include" });
        if (res.ok && alive) setMeter(await res.json());
      } catch {
        // A failed poll is cosmetic; the class keeps going.
      }
    };
    void poll();
    const id = setInterval(poll, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [classSessionId]);

  return (
    <div className="hidden sm:block text-right">
      <p className="text-xs font-semibold text-text tabular-nums">
        {meter ? `${meter.billableMinutes} min · ${meter.coinsSoFar} coins` : "—"}
      </p>
      <p className="text-[10px] text-text-subtle">
        {coinsPerMinute} coins/min
        {meter && meter.projectedRefund > 0 ? ` · ${meter.projectedRefund} returned if you leave now` : ""}
      </p>
    </div>
  );
}

function Countdown({ hardEndsAt, scheduledEnd }: { hardEndsAt: string; scheduledEnd: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const endMs = new Date(scheduledEnd).getTime();
  const hardMs = new Date(hardEndsAt).getTime();
  const remaining = Math.max(0, endMs - now);
  const overrun = now > endMs;
  const hardRemaining = Math.max(0, hardMs - now);

  const fmt = (ms: number) => {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  return (
    <span
      className={`text-xs font-medium tabular-nums ${
        overrun ? "text-amber-500" : remaining < 5 * 60_000 ? "text-amber-500" : "text-text-muted"
      }`}
      title={overrun ? "This class is past its scheduled end" : "Time remaining"}
    >
      {overrun ? `+${fmt(now - endMs)} over · closes in ${fmt(hardRemaining)}` : fmt(remaining)}
    </span>
  );
}

// ── Stage ───────────────────────────────────────────────────────────────────

function Stage({ otherPartyName }: { otherPartyName: string }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const remoteCameras = tracks.filter(
    (t) => t.source === Track.Source.Camera && !t.participant.isLocal
  );
  const localCamera = tracks.find(
    (t) => t.source === Track.Source.Camera && t.participant.isLocal
  );

  // Screen share takes the stage when present — in a language class it is
  // almost always the material being taught from.
  const main = screenShare ?? remoteCameras[0];

  return (
    <div className="flex-1 relative bg-[#0f0c29] min-w-0">
      {main ? (
        <Tile trackRef={main} className="w-full h-full" contain={Boolean(screenShare)} />
      ) : (
        <div className="w-full h-full grid place-items-center">
          <div className="text-center text-white/50 px-6">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-70" />
            <p className="text-sm">Waiting for {otherPartyName} to join…</p>
            <p className="text-xs mt-1 text-white/30">
              You are not being charged until they arrive.
            </p>
          </div>
        </div>
      )}

      {/* Remaining remote cameras, when a screen share is on stage. */}
      {screenShare && remoteCameras.length > 0 && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {remoteCameras.map((t) => (
            <Tile
              key={t.participant.identity + t.source}
              trackRef={t}
              className="w-40 h-28 rounded-xl overflow-hidden border border-white/10 shadow-lg"
            />
          ))}
        </div>
      )}

      {/* Self view. Mirrored, because an unmirrored self view is disorienting. */}
      <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-48 sm:h-36 rounded-xl overflow-hidden border border-white/10 bg-surface-inset shadow-lg">
        {localCamera && localCamera.publication ? (
          <VideoTrack trackRef={localCamera} className="w-full h-full object-cover -scale-x-100" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <span className="text-[11px] text-white/50">Camera off</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  trackRef,
  className,
  contain = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  contain?: boolean;
}) {
  return (
    <div className={`relative bg-black/40 ${className ?? ""}`}>
      {trackRef.publication && trackRef.publication.track ? (
        <VideoTrack
          trackRef={trackRef}
          className={`w-full h-full ${contain ? "object-contain" : "object-cover"}`}
        />
      ) : (
        <div className="w-full h-full grid place-items-center">
          <span className="text-sm text-white/50">
            {trackRef.participant.name || trackRef.participant.identity}
          </span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 text-[11px] text-white/90">
        {trackRef.participant.name || trackRef.participant.identity}
      </span>
    </div>
  );
}

// ── Chat ────────────────────────────────────────────────────────────────────

const CHAT_TOPIC = "lm-chat";

/**
 * In-class chat over LiveKit's data channel.
 *
 * Data messages ride the existing WebRTC connection, so chat adds no API
 * calls, no database writes and no measurable cost. The previous placeholder
 * pushed messages into local React state, which meant the other person never
 * saw them.
 */
function ChatPanel({
  selfName,
  onRead,
  onIncoming,
}: {
  selfName: string;
  onRead: () => void;
  onIncoming: () => void;
}) {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const { localParticipant } = useLocalParticipant();

  const { send } = useDataChannel(CHAT_TOPIC, (msg) => {
    try {
      const decoded = JSON.parse(new TextDecoder().decode(msg.payload)) as {
        text: string;
        sender: string;
      };
      const self = msg.from?.identity === localParticipant.identity;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender: decoded.sender,
          text: decoded.text,
          at: Date.now(),
          self,
        },
      ]);
      if (!self) onIncoming();
    } catch {
      // Ignore anything that is not our own message shape.
    }
  });

  useEffect(() => {
    onRead();
  }, [onRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const payload = new TextEncoder().encode(JSON.stringify({ text, sender: selfName }));
    // `reliable` so a message is not silently dropped on a lossy link.
    send(payload, { reliable: true });
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}`, sender: selfName, text, at: Date.now(), self: true },
    ]);
    setDraft("");
  }, [draft, selfName, send]);

  return (
    <aside className="w-full max-w-xs sm:w-80 border-l border-border bg-surface flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">In-class chat</h3>
        <p className="text-[11px] text-text-subtle">Messages are not saved after the class.</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">No messages yet</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.self ? "text-right" : ""}>
              <span className="text-[10px] text-text-subtle">
                {m.sender} ·{" "}
                {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p
                className={`mt-0.5 px-3 py-1.5 rounded-lg inline-block max-w-[85%] text-sm break-words ${
                  m.self ? "bg-brand/10 text-text" : "bg-surface-inset text-text"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={1000}
            placeholder="Type a message…"
            aria-label="Chat message"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface-inset text-sm text-text placeholder:text-text-subtle focus:outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submit}
            aria-label="Send message"
            className="p-2 rounded-lg bg-brand text-white hover:bg-brand-hover transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function Controls({
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

  const isTeacher = grant.role === "TEACHER";
  const audioOnly = QUALITY_PROFILES[grant.profile].audioOnly;

  const toggleRecording = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${classSessionId}/recording`, {
        method: recording ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: recording ? undefined : JSON.stringify({ mode: "audio" }),
      });
      if (res.ok) setRecording((v) => !v);
    } finally {
      setBusy(false);
    }
  }, [classSessionId, recording]);

  const endClass = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`/api/live/${classSessionId}/end`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setBusy(false);
      onLeave();
    }
  }, [classSessionId, onLeave]);

  const btn = (active: boolean) =>
    `p-3 rounded-xl transition-all ${
      active ? "bg-surface-inset text-text hover:bg-border" : "bg-red-500/10 text-red-500"
    }`;

  return (
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
  );
}

// ── States ──────────────────────────────────────────────────────────────────

function FullscreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <span className="text-sm text-text-muted">{label}</span>
      </div>
    </div>
  );
}

function JoinBlocked({
  error,
  exitHref,
  onRetry,
}: {
  error: TokenError;
  exitHref: string;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!error.joinOpensAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [error.joinOpensAt]);

  const opensIn = error.joinOpensAt
    ? Math.max(0, new Date(error.joinOpensAt).getTime() - now)
    : null;

  // Once the doors open, retry automatically instead of making the student
  // guess when to press the button again.
  useEffect(() => {
    if (opensIn === 0) onRetry();
  }, [opensIn, onRetry]);

  const headline: Record<string, string> = {
    TOO_EARLY: "Not quite yet",
    TOO_LATE: "This class has closed",
    SESSION_COMPLETED: "This class has finished",
    SESSION_CANCELLED: "This class was cancelled",
    NOT_A_PARTICIPANT: "You are not in this class",
    NOT_CONFIGURED: "Live classes are unavailable",
    BUDGET_EXCEEDED: "Live classes are temporarily paused",
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-8 text-center">
        <h2 className="text-xl font-bold text-text mb-2">
          {headline[error.code] ?? "Unable to join"}
        </h2>
        <p className="text-text-muted mb-6">{error.message}</p>

        {opensIn !== null && opensIn > 0 && (
          <p className="text-3xl font-semibold text-brand tabular-nums mb-6">
            {Math.floor(opensIn / 60_000)}:
            {String(Math.floor((opensIn % 60_000) / 1000)).padStart(2, "0")}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <a
            href={exitHref}
            className="px-4 py-2 rounded-xl border border-border text-sm text-text-muted hover:text-text transition-colors"
          >
            Back to classes
          </a>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-all"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRoomContext, useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { ArrowLeft, WifiOff } from "lucide-react";
import type { TokenResponse, Meter } from "../types";
import { Stage } from "./Stage";
import { ChatPanel } from "./ChatPanel";
import { Controls } from "./Controls";

export function ClassroomShell({
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
  const markRead = useCallback(() => setUnread(0), []);
  const receiveMessage = useCallback(() => {
    if (!chatOpen) setUnread((count) => count + 1);
  }, [chatOpen]);

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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Stage otherPartyName={grant.otherPartyName} />
        <ChatPanel
          selfName={grant.participantName}
          open={chatOpen}
          onRead={markRead}
          onIncoming={receiveMessage}
        />
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

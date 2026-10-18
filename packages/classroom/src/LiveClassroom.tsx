"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { QUALITY_PROFILES, buildConnectOptions, buildRoomOptions, type QualityProfileId } from "@repo/livekit/client";
import type { LiveClassroomProps, TokenResponse, TokenError } from "./types";
import { Prejoin } from "./components/Prejoin";
import { ClassroomShell } from "./components/ClassroomShell";
import { FullscreenSpinner, JoinBlocked } from "./components/States";

export type { LiveClassroomProps } from "./types";

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

  const join = useCallback(async () => {
    const nextGrant = await requestToken(profile);
    if (nextGrant) setJoined(true);
  }, [profile, requestToken]);

  useEffect(() => {
    if (autoJoin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void requestToken("low").then((g) => {
        if (g) setJoined(true);
      });
    }
  }, [autoJoin, requestToken]);

  if (error && !joined) {
    return <JoinBlocked error={error} exitHref={exitHref} onRetry={join} />;
  }

  if (!joined) {
    return (
      <Prejoin
        classSessionId={classSessionId}
        exitHref={exitHref}
        profile={profile}
        onProfileChange={setProfile}
        connecting={connecting}
        onJoin={join}
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

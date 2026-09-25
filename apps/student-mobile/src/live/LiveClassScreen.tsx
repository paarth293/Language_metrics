/**
 * Live class screen (Expo / React Native).
 *
 * Mirrors the web classroom: prejoin-free entry (mobile users expect to tap
 * and be in), audio routed to the speaker, a live cost meter, and an explicit
 * leave that disconnects rather than relying on the screen unmounting.
 *
 * Mobile defaults to a lower quality profile than web on purpose. Lessons get
 * taken on mobile data far more often than on wifi, and the student pays for
 * that data twice — once to their carrier and once, indirectly, through our
 * LiveKit bandwidth bill.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from "@livekit/react-native";
import { Track } from "livekit-client";

import { AppText, Button } from "../components/ui";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/tokens";
import { MobileApiClient as api } from "../lib/api-client";

interface Grant {
  token: string;
  serverUrl: string;
  otherPartyName: string;
  coinsPerMinute: number;
  heldCoins: number;
  scheduledEnd: string;
  hardEndsAt: string;
  profile: string;
}

export function LiveClassScreen({
  classSessionId,
  onExit,
}: {
  classSessionId: string;
  onExit: () => void;
}) {
  const { colors } = useTheme();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Route audio to the speaker and claim the audio focus. Without this the
  // call comes out of the earpiece at barely audible volume on Android, which
  // users report as "the teacher's mic is broken".
  useEffect(() => {
    let started = false;
    void (async () => {
      await AudioSession.startAudioSession();
      started = true;
    })();
    return () => {
      if (started) void AudioSession.stopAudioSession();
    };
  }, []);

  const join = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getLiveKitToken(classSessionId);
      setGrant(res as unknown as Grant);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Could not join the class.";
      setError(message);
    }
  }, [classSessionId]);

  useEffect(() => {
    void join();
  }, [join]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <AppText variant="h1" style={styles.centerText}>
          Unable to join
        </AppText>
        <AppText tone="muted" style={[styles.centerText, { marginTop: spacing.sm }]}>
          {error}
        </AppText>
        <Button label="Try again" onPress={join} style={{ marginTop: spacing.xl, alignSelf: "stretch" }} />
        <Button
          label="Back to classes"
          variant="outline"
          onPress={onExit}
          style={{ marginTop: spacing.sm, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  if (!grant) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.action} />
        <AppText tone="muted" style={{ marginTop: spacing.lg }}>
          Connecting to your class…
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0c29" }}>
      <LiveKitRoom
        serverUrl={grant.serverUrl}
        token={grant.token}
        connect
        audio
        video={grant.profile !== "audio-only"}
        options={{
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            dtx: true,
            red: true,
            simulcast: true,
            videoCodec: "h264",
            videoEncoding: { maxBitrate: 260_000, maxFramerate: 20 },
          },
          // 360p capture. Anything larger is thrown away by the encoder on the
          // way out and costs the student's data allowance on the way in.
          videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 20 } },
        }}
        onDisconnected={onExit}
        onError={(e: any) => setError(e.message)}
      >
        <ClassStage grant={grant} onLeave={onExit} classSessionId={classSessionId} />
      </LiveKitRoom>
    </View>
  );
}

function ClassStage({
  grant,
  onLeave,
  classSessionId,
}: {
  grant: Grant;
  onLeave: () => void;
  classSessionId: string;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [meter, setMeter] = useState<{ billableMinutes: number; coinsSoFar: number } | null>(null);

  const remote = useMemo(() => tracks.find((t: any) => !t.participant.isLocal), [tracks]);
  const local = useMemo(() => tracks.find((t: any) => t.participant.isLocal), [tracks]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await api.getLiveMeter(classSessionId);
        if (alive) setMeter(res);
      } catch {
        /* cosmetic */
      }
    };
    void poll();
    const id = setInterval(poll, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [classSessionId]);

  const pipW = Math.min(120, width * 0.3);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.stage}>
        {remote ? (
          <VideoTrack trackRef={remote} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
            <AppText style={[styles.waiting, { marginTop: spacing.lg }]}>
              Waiting for {grant.otherPartyName}…
            </AppText>
            <AppText style={[styles.waitingSub, { marginTop: spacing.xs }]}>
              You are not charged until they join.
            </AppText>
          </View>
        )}

        {local && isCameraEnabled && (
          <View style={[styles.pip, { width: pipW, height: pipW * 0.75 }]}>
            <VideoTrack trackRef={local} style={StyleSheet.absoluteFill} objectFit="cover" mirror />
          </View>
        )}

        {meter && (
          <View style={styles.meter}>
            <AppText style={styles.meterText}>
              {meter.billableMinutes} min · {meter.coinsSoFar} coins
            </AppText>
          </View>
        )}
      </View>

      <View style={[styles.controls, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ControlButton
          active={isMicrophoneEnabled}
          label={isMicrophoneEnabled ? "Mute" : "Unmute"}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          colors={colors}
        />
        {grant.profile !== "audio-only" && (
          <ControlButton
            active={isCameraEnabled}
            label={isCameraEnabled ? "Camera off" : "Camera on"}
            onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
            colors={colors}
          />
        )}
        <Pressable onPress={onLeave} style={[styles.leave, { backgroundColor: colors.alert }]}>
          <AppText style={styles.leaveText}>Leave</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function ControlButton({
  active,
  label,
  onPress,
  colors,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  colors: { surfaceInset: string; text: string; alert: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[
        styles.control,
        { backgroundColor: active ? colors.surfaceInset : `${colors.alert}22` },
      ]}
    >
      <AppText style={{ color: active ? colors.text : colors.alert, fontSize: 13 }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  centerText: { textAlign: "center" },
  stage: { flex: 1, backgroundColor: "#0f0c29" },
  waiting: { color: "rgba(255,255,255,0.75)", textAlign: "center" },
  waitingSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" },
  pip: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "#000",
  },
  meter: {
    position: "absolute",
    left: spacing.lg,
    top: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  meterText: { color: "#fff", fontSize: 12 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
  },
  control: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 12 },
  leave: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: 12, marginLeft: spacing.sm },
  leaveText: { color: "#fff", fontWeight: "600" },
});

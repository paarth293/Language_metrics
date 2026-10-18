"use client";

import { Loader2, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { QUALITY_PROFILES, type QualityProfileId } from "@repo/livekit/client";
import { usePrejoinDevices } from "../hooks/usePrejoinDevices";

export function Prejoin({
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
  // Kept separate from `devices` so only this callback is treated as a ref.
  const { attachVideo } = devices;
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-72px)] bg-bg px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
          <div className="relative aspect-video bg-surface-inset flex items-center justify-center">
            {devices.cameraEnabled && devices.videoTrack ? (
              <video
                ref={attachVideo}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-contain -scale-x-100"
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

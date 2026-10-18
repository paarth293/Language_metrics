"use client";

import { VideoTrack, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Loader2 } from "lucide-react";

export function Stage({ otherPartyName }: { otherPartyName: string }) {
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
    <div className="flex-1 relative bg-[#0f0c29] min-w-0 min-h-0">
      {main ? (
        <div className="absolute inset-0">
          <Tile trackRef={main} className="w-full h-full" />
        </div>
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
          <VideoTrack trackRef={localCamera} className="absolute inset-0 w-full h-full object-contain -scale-x-100" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <span className="text-[11px] text-white/50">Camera off</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Preserve the entire camera/share frame even when the tile has a different aspect ratio.
function Tile({
  trackRef,
  className,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
}) {
  const hasVideo = Boolean(trackRef.publication?.track);
  return (
    <div className={`relative bg-black/40 ${className ?? ""}`}>
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef as import("@livekit/components-react").TrackReference}
          className="absolute inset-0 w-full h-full object-contain"
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

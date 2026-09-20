/**
 * @repo/livekit/client — browser room configuration.
 *
 * Imports livekit-client, which is a peer dependency. Safe to import from a
 * client component; contains no secrets.
 *
 * Everything in here exists to reduce downstream bandwidth, which is the
 * larger half of a LiveKit bill for a video product.
 */

import {
  type AudioCaptureOptions,
  type RoomConnectOptions,
  type RoomOptions,
  type TrackPublishDefaults,
  type VideoCaptureOptions,
  VideoPreset,
} from "livekit-client";

import { QUALITY_PROFILES, type QualityProfileId } from "./config";

// Re-exported so a client component can pull the profile table and the room
// options from one import, without reaching into the isomorphic entry point
// (which server code also imports).
export { QUALITY_PROFILES, type QualityProfileId };

/**
 * Build RoomOptions for a quality profile.
 *
 * The three flags that matter most, and why:
 *
 *   adaptiveStream — the SFU sends a resolution matched to the size the video
 *     element is actually rendered at. A 180x120 thumbnail receives the 180p
 *     layer, not the 360p one. Free bandwidth savings, no visible difference.
 *
 *   dynacast — the publisher stops encoding and sending layers nobody is
 *     subscribed to. When the student minimises the teacher's video, the
 *     teacher's browser stops uploading it. This is the single biggest lever
 *     in the file.
 *
 *   simulcast — lets the two above have layers to choose between. Without it
 *     the other two have nothing to work with.
 */
export function buildRoomOptions(profileId: QualityProfileId): RoomOptions {
  const profile = QUALITY_PROFILES[profileId];

  const audioCaptureDefaults: AudioCaptureOptions = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };

  const publishDefaults: TrackPublishDefaults = {
    // DTX stops sending audio packets during silence. In a language lesson
    // one person is listening most of the time, so this is substantial.
    dtx: true,
    // RED adds redundant audio payloads. Costs a little bandwidth, buys a lot
    // of intelligibility on lossy mobile links — the right trade for a
    // product where hearing a vowel correctly is the entire point.
    red: true,
    audioPreset: {
      maxBitrate: profile.audioBitrate,
    },
    // H.264 has hardware encode/decode almost everywhere, which matters more
    // than VP9's efficiency on the low-end Android phones this will run on.
    videoCodec: "h264",
    simulcast: !profile.audioOnly && profile.simulcastLayers.length > 0,
    videoEncoding: {
      maxBitrate: profile.videoBitrate,
      maxFramerate: profile.frameRate,
    },
    videoSimulcastLayers: profile.simulcastLayers.map(
      (layer) =>
        new VideoPreset(layer.width, layer.height, layer.bitrate, layer.frameRate)
    ),
    // Screen share is text-heavy (slides, documents), so preserve resolution
    // over frame rate when the link is constrained.
    screenShareEncoding: {
      maxBitrate: 900_000,
      maxFramerate: 5,
    },
    degradationPreference: "maintain-resolution",
    stopMicTrackOnMute: false,
  };

  const videoCaptureDefaults: VideoCaptureOptions = profile.audioOnly
    ? {}
    : {
        resolution: {
          width: profile.width,
          height: profile.height,
          frameRate: profile.frameRate,
        },
      };

  return {
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: true,
    audioCaptureDefaults,
    videoCaptureDefaults,
    publishDefaults,
  };
}

/**
 * Connect options.
 *
 * autoSubscribe stays on: in a 1:1 class you always want the other person's
 * tracks, and adaptiveStream already handles not wasting bandwidth on them.
 */
export function buildConnectOptions(): RoomConnectOptions {
  return {
    autoSubscribe: true,
    maxRetries: 5,
  };
}

export const QUALITY_PROFILE_OPTIONS: Array<{ id: QualityProfileId; label: string }> =
  Object.values(QUALITY_PROFILES).map((p) => ({ id: p.id, label: p.label }));

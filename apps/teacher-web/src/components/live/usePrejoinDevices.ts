"use client";

/**
 * Device preview that does NOT connect to the room.
 *
 * This hook is a cost control disguised as a UX nicety. The obvious way to
 * build a "check your camera and mic" screen is to join the room and look at
 * your own published track — and that starts the meter. A student who opens
 * the page five minutes early, fiddles with their headphones and then waits
 * for the teacher has burned five billable participant-minutes before the
 * lesson began, every single class.
 *
 * `createLocalTracks` opens the hardware locally and touches no network, so
 * the preview is free. The room connection happens only when the user presses
 * Join.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";

export interface PrejoinState {
  videoTrack: LocalVideoTrack | null;
  audioTrack: LocalAudioTrack | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  /** RMS level 0..1, for the mic meter. */
  micLevel: number;
  error: string | null;
  ready: boolean;
  toggleCamera: () => Promise<void>;
  toggleMic: () => Promise<void>;
  attachVideo: (el: HTMLVideoElement | null) => void;
  /** Release the hardware. Always call before connecting to the room. */
  stop: () => void;
}

export function usePrejoinDevices(options: {
  width: number;
  height: number;
  audioOnly: boolean;
}): PrejoinState {
  const { width, height, audioOnly } = options;

  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(!audioOnly);
  const [micEnabled, setMicEnabled] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const analyserCleanup = useRef<(() => void) | null>(null);
  const stoppedRef = useRef(false);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
  }, []);

  // Acquire devices once on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const audio = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        if (cancelled) {
          audio.stop();
          return;
        }
        setAudioTrack(audio);

        if (!audioOnly) {
          const video = await createLocalVideoTrack({
            resolution: { width, height, frameRate: 24 },
          });
          if (cancelled) {
            video.stop();
            return;
          }
          setVideoTrack(video);
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera and microphone access was blocked. Allow it in your browser's address bar, then reload."
            : name === "NotFoundError"
              ? "No camera or microphone was found. You can still join to listen."
              : "Could not start your camera or microphone."
        );
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [width, height, audioOnly]);

  // Keep the preview element attached to whatever track currently exists.
  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  // Live mic level, so a student with a dead microphone finds out here rather
  // than four minutes into a paid lesson.
  useEffect(() => {
    if (!audioTrack || !micEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMicLevel(0);
      return;
    }
    const mediaStreamTrack = audioTrack.mediaStreamTrack;
    if (!mediaStreamTrack) return;

    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Audio analysis is decorative; never let it break the join flow.
    }

    analyserCleanup.current = () => {
      cancelAnimationFrame(raf);
      void ctx?.close();
    };
    return () => analyserCleanup.current?.();
  }, [audioTrack, micEnabled]);

  const toggleCamera = useCallback(async () => {
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(null);
      setCameraEnabled(false);
      return;
    }
    try {
      const track = await createLocalVideoTrack({
        resolution: { width, height, frameRate: 24 },
      });
      setVideoTrack(track);
      setCameraEnabled(true);
    } catch {
      setError("Could not start your camera.");
    }
  }, [videoTrack, width, height]);

  const toggleMic = useCallback(async () => {
    if (!audioTrack) return;
    const next = !micEnabled;
    await audioTrack.mute();
    if (next) await audioTrack.unmute();
    setMicEnabled(next);
  }, [audioTrack, micEnabled]);

  const stop = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    analyserCleanup.current?.();
    videoTrack?.stop();
    audioTrack?.stop();
  }, [videoTrack, audioTrack]);

  // Release hardware if the component unmounts without an explicit stop —
  // otherwise the camera light stays on after the user navigates away.
  useEffect(() => () => stop(), [stop]);

  return {
    videoTrack,
    audioTrack,
    cameraEnabled,
    micEnabled,
    micLevel,
    error,
    ready,
    toggleCamera,
    toggleMic,
    attachVideo,
    stop,
  };
}

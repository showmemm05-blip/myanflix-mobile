import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
}

interface Props {
  playlistUrl: string;
  paused: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  onProgress: (data: { currentTime: number; bufferedSeconds: number }) => void;
  onLoad: (data: { durationSeconds: number }) => void;
  onBufferingChange: (isBuffering: boolean) => void;
  onEnd: () => void;
  onError: (message: string | undefined) => void;
}

// After a seek, ExoPlayer/AVPlayer can report a stale or transiently-wrong
// currentTime (including 0) for a tick or two while it tears down and
// reconfigures the decoder for the new position — most visible on a big
// forward seek into a part of the HLS stream that was never buffered, which
// needs fresh segments fetched before the player's position genuinely
// settles there. Relaying those transient ticks straight into onProgress is
// what made seeking look like "jumps back to 0:00": the UI's optimistic
// target got immediately overwritten by one of these bad in-between reports.
// Holding onProgress until the reported currentTime is actually close to the
// target (or a generous backstop elapses) fixes this — no special "seek
// complete" event needed, expo-video doesn't have one, this just gates the
// existing one.
const SEEK_SETTLE_MS = 10000;
const SEEK_PROXIMITY_SECONDS = 1.5;

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { playlistUrl, paused, rate, volume, muted, onProgress, onLoad, onBufferingChange, onEnd, onError },
  ref,
) {
  const pendingSeekRef = useRef<number | null>(null);
  const seekSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer({ uri: playlistUrl, contentType: "hls" }, (p) => {
    p.timeUpdateEventInterval = 0.5;
  });

  useImperativeHandle(
    ref,
    () => ({
      seek: (seconds: number) => {
        pendingSeekRef.current = seconds;
        player.currentTime = seconds;
        if (seekSettleTimeoutRef.current) clearTimeout(seekSettleTimeoutRef.current);
        // Backstop only — normally the proximity check in the timeUpdate
        // listener below clears this well before it fires. Long enough that
        // a far seek needing real network time to fetch fresh segments isn't
        // cut off early, but guarantees onProgress resumes flowing even if
        // the player's reported position never converges to the exact
        // target (e.g. because of the seek tolerance rounding to a nearby
        // keyframe).
        seekSettleTimeoutRef.current = setTimeout(() => {
          if (pendingSeekRef.current === null) return;
          pendingSeekRef.current = null;
          seekSettleTimeoutRef.current = null;
          onProgress({ currentTime: player.currentTime, bufferedSeconds: player.bufferedPosition });
        }, SEEK_SETTLE_MS);
      },
    }),
    [player, onProgress],
  );

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  useEffect(() => {
    player.playbackRate = rate;
  }, [player, rate]);

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, paused]);

  useEffect(() => {
    return () => {
      if (seekSettleTimeoutRef.current) clearTimeout(seekSettleTimeoutRef.current);
    };
  }, []);

  useEventListener(player, "timeUpdate", (payload) => {
    const target = pendingSeekRef.current;
    if (target !== null) {
      if (Math.abs(payload.currentTime - target) > SEEK_PROXIMITY_SECONDS) return;
      pendingSeekRef.current = null;
      if (seekSettleTimeoutRef.current) {
        clearTimeout(seekSettleTimeoutRef.current);
        seekSettleTimeoutRef.current = null;
      }
    }
    onProgress({ currentTime: payload.currentTime, bufferedSeconds: payload.bufferedPosition });
  });

  useEventListener(player, "sourceLoad", (payload) => {
    // Guard against a spurious re-emission mid-playback (observed around
    // big seeks, presumably tied to rendition reconfiguration) reporting an
    // unset/zero duration — applying that would reset the progress bar's
    // total to 0:00 even though nothing about the source actually changed.
    if (payload.duration > 0) {
      onLoad({ durationSeconds: payload.duration });
    }
  });

  useEventListener(player, "playToEnd", () => {
    onEnd();
  });

  useEventListener(player, "statusChange", (payload) => {
    if (payload.status === "error") {
      onError(payload.error?.message);
    }
    onBufferingChange(payload.status === "loading");
  });

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      // Default surfaceView is a hardware overlay layer on Android that can
      // intercept touches ahead of RN's own view hierarchy, breaking the
      // controls overlay rendered on top of it — textureView composites
      // normally. This is the documented recommendation for exactly this
      // "overlapping video views" case.
      surfaceType="textureView"
    />
  );
});

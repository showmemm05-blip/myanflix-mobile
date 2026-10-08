import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import { useVideoPlayer, VideoView, type SubtitleTrack } from "expo-video";
import { useEventListener } from "expo";
import { isSameSubtitleTrack } from "@/video/subtitleTracks";

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
}

interface Props {
  playlistUrl: string;
  paused: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  /**
   * The rendition the NATIVE renderer should paint, picked out of the list
   * reported by `onSubtitleTracksChange`. Normally `null`: the app draws
   * captions itself (see SubtitleOverlay), and this is the only way to stop
   * the player drawing a second copy underneath. The screen passes a real
   * track only as a fallback, when the cue file behind its own overlay could
   * not be read.
   */
  subtitleTrack: SubtitleTrack | null;
  /**
   * Whether the screen has received the rendition list yet. The selection can
   * only be pushed to the player once the tracks exist, and this is the one
   * signal that says so in the same commit as `subtitleTrack` — deriving it
   * inside this component from the raw events would race the screen's own
   * resolution of which track to display.
   */
  subtitleTracksReady: boolean;
  /** Fires with the renditions declared in the manifest, as they are discovered. */
  onSubtitleTracksChange: (tracks: SubtitleTrack[]) => void;
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

// The caption overlay decides which cue is showing from the position this tick
// reports, so the tick IS the caption clock: at the old 0.5s a line could
// appear half a second after it was spoken and linger as long past its end.
// 0.25 halves that error; expo-video has no cue event to use instead.
const TIME_UPDATE_INTERVAL_SECONDS = 0.25;

/**
 * Memoised: the screen re-renders on every playback tick (4×/s), and this
 * component only needs to when one of its props really changes. That holds
 * because Player passes stable callbacks (see its `videoEventsRef`); an inline
 * arrow here would quietly bring the per-tick re-render back.
 */
export const VideoPlayer = memo(forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  {
    playlistUrl,
    paused,
    rate,
    volume,
    muted,
    subtitleTrack,
    subtitleTracksReady,
    onSubtitleTracksChange,
    onProgress,
    onLoad,
    onBufferingChange,
    onEnd,
    onError,
  },
  ref,
) {
  const pendingSeekRef = useRef<number | null>(null);
  const seekSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `undefined` = the selection has never been pushed to the player yet. See
  // the subtitle effect below for why this is tracked here rather than read
  // back off the player.
  const appliedSubtitleRef = useRef<SubtitleTrack | null | undefined>(undefined);
  // The latest onProgress, for the seek backstop below. Read through a ref so
  // the imperative handle is not rebuilt whenever the callback's identity
  // changes (it used to be rebuilt on every 0.25 s tick).
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const player = useVideoPlayer({ uri: playlistUrl, contentType: "hls" }, (p) => {
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SECONDS;
  });

  // WHICH player the selection above was written to. expo-video keys the
  // player on the source, so a refreshed signed link hands this component a
  // brand-new one without remounting it — see the subtitle effect.
  const appliedPlayerRef = useRef<typeof player | null>(null);

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
          onProgressRef.current({ currentTime: player.currentTime, bufferedSeconds: player.bufferedPosition });
        }, SEEK_SETTLE_MS);
      },
    }),
    [player],
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

  /**
   * Pushes the chosen rendition into the player, asserting it ONCE as soon as
   * the tracks exist even when the choice is `null` — which, now that the app
   * paints its own captions, is the usual case.
   *
   * That first assertion is not redundant. ExoPlayer's default track selection
   * treats a text track carrying `SELECTION_FLAG_DEFAULT` as eligible on its
   * own, and the backend marks the default subtitle `DEFAULT=YES` in the
   * master playlist — so on Android the cues start rendering by themselves.
   * expo-video does not see that: its `subtitleTrack` getter only reports an
   * explicit override or a preferred-language match, so it keeps returning
   * `null` while captions are visibly on screen. Comparing against the getter
   * would therefore skip the write, leaving the menu saying "Off" over burnt-in
   * captions the viewer cannot turn off. Writing `null` disables the text
   * renderer outright — which is what keeps the native cues from showing
   * through UNDER the overlay's own, and what makes "Off" mean off.
   *
   * The guard is against what THIS component last wrote, so a re-report of the
   * same renditions (new objects, equal values) does not needlessly tear down
   * and rebuild the text renderer mid-playback.
   *
   * It is also keyed on the player the write landed on, because the player is
   * NOT the same object for the life of this component: `useVideoPlayer` keys
   * it on the source, so refetching an expired signed link builds a fresh one
   * with ExoPlayer's own defaults back — including the `DEFAULT=YES` text
   * rendition. Matching only on the value would treat "already off" as true of
   * a player that was never told, and the native cues would come back up under
   * the overlay after every link refresh.
   */
  useEffect(() => {
    if (!subtitleTracksReady) return;
    const sameNativePlayer = appliedPlayerRef.current === player;
    if (
      sameNativePlayer &&
      appliedSubtitleRef.current !== undefined &&
      isSameSubtitleTrack(appliedSubtitleRef.current, subtitleTrack)
    ) {
      return;
    }
    appliedPlayerRef.current = player;
    appliedSubtitleRef.current = subtitleTrack;
    player.subtitleTrack = subtitleTrack;
  }, [player, subtitleTrack, subtitleTracksReady]);

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
    // Same spurious-re-emission caveat as the duration above: an empty list
    // here means "not parsed yet", never "this title has no subtitles" — that
    // answer only ever comes from the event below, which is authoritative.
    if (payload.availableSubtitleTracks.length > 0) {
      onSubtitleTracksChange(payload.availableSubtitleTracks);
    }
  });

  // The subtitle renditions are NOT reliably present the moment the source
  // loads — the player discovers them as it parses the master playlist, so the
  // list arrives (or grows) after `sourceLoad` has already fired. Both are
  // relayed; the screen de-duplicates by value so the extra report is free.
  useEventListener(player, "availableSubtitleTracksChange", (payload) => {
    onSubtitleTracksChange(payload.availableSubtitleTracks);
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
}));

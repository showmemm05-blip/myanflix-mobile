import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { ThemedText } from "@/components/ui/ThemedText";
import { BufferingDots } from "@/components/player/BufferingDots";
import { ChromeButton } from "@/components/player/PlayerControls";
import { PlayerGlyph } from "@/components/player/PlayerGlyph";
import { adsApi } from "@/api/ads.api";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AdPlaybackEvent, VideoAd } from "@/types/ads";

/** How a play ended — the terminal event sent for it, and what the screen is told. */
export type PrerollAdFinishReason = "completed" | "skipped" | "failed";

interface Props {
  ad: VideoAd;
  muted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBack: () => void;
  /** Called exactly once, however the ad ends; the screen then mounts the film. */
  onFinished: (reason: PrerollAdFinishReason) => void;
  /** A quiet line under the countdown — at a break, "The movie continues after the ad". */
  note?: string;
}

/**
 * How long the ad may sit in "loading" — before its first frame or while
 * rebuffering — before it is written off and the film plays instead. An ad
 * is never worth a black stage: the viewer came for the film.
 */
const STALL_TIMEOUT_MS = 10_000;
/**
 * The beat before a pause this component did not ask for is answered with
 * `play()` — see the `playingChange` listener. Long enough for the OS to
 * have finished whatever took the audio, short enough that the viewer
 * barely sees the picture hold.
 */
const RESUME_RETRY_DELAY_MS = 500;
/** The countdown and the skip gate read the player's own clock; twice a second keeps "Skip in 3" honest to the second. */
const TIME_UPDATE_INTERVAL_SECONDS = 0.5;
/** The chrome's text-size cap, as PlayerControls. */
const CHROME_FONT_CAP = 1.6;

/** PlayerControls' scrims, in the page ground's hue, so the ad reads as the same stage. */
const SCRIM_TOP = ["rgba(8,8,11,0.72)", "rgba(8,8,11,0)"] as const;
const SCRIM_TOP_FULL = ["rgba(8,8,11,0.78)", "rgba(8,8,11,0)"] as const;
const SCRIM_BOTTOM = ["rgba(8,8,11,0)", "rgba(8,8,11,0.82)"] as const;
const SCRIM_BOTTOM_FULL = ["rgba(8,8,11,0)", "rgba(8,8,11,0.88)"] as const;

/**
 * The pre-roll advertisement, played in the Player's stage BEFORE the film on
 * a video player of its own. A separate instance rather than the film's: the
 * ad is a plain MP4 where the film is HLS, and the film's VideoPlayer carries
 * seek-settling, subtitle and quality bookkeeping that an ad has no business
 * touching. `useVideoPlayer` releases this one when the component unmounts,
 * which the screen does the moment `onFinished` is called — so the film's
 * player is the only one decoding once the film starts.
 *
 * It owns its chrome too — Back, "Advertisement" and the title, mute, the
 * countdown, Skip and fullscreen — on the same insets as PlayerControls, and
 * never hides it: the countdown and Skip are what the viewer is waiting on.
 * No seek line, no play/pause, no speed: an ad is watched, not driven.
 *
 * Every way out goes through `finish`, which runs once: the end of the file
 * (`playToEnd`), Skip, a player error, or ten seconds stuck loading. The
 * server hears about each (`started` on the first frame, then exactly one of
 * `completed` / `skipped` / `failed`), de-duplicated here so a repeated native
 * event costs nothing.
 *
 * The same component plays the ad at a mid-roll break (2026-11-04), over the
 * film's paused player rather than in its place — the film keeps its buffer,
 * quality and position — with `note` saying the film comes back after it.
 * Memoised: the Player re-renders four times a second off the film's tick,
 * and every prop it passes here is state or a stable callback.
 */
export const PrerollAdPlayer = memo(function PrerollAdPlayer({
  ad,
  muted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onBack,
  onFinished,
  note,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(0);
  /** The file's own duration once the player reports it; the API's figure until then. */
  const [mediaDuration, setMediaDuration] = useState(0);
  const [started, setStarted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const finishedRef = useRef(false);
  const sentRef = useRef<Set<AdPlaybackEvent>>(new Set());
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The pending `play()` retry after an OS pause — see the `playingChange` listener. */
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The last reported second, for the terminal event — state would be a render behind. */
  const currentTimeRef = useRef(0);
  // The latest callbacks, so a timer or a native event registered on an
  // earlier render still reaches the screen's current handlers.
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // `progressive`, not the default `auto`: the signed link has no .mp4
  // extension for the player to guess from. Caching is on so a rebuffer
  // re-reads from disk; progressive sources may be cached on both platforms.
  const source = useMemo(
    () => ({ uri: ad.videoUrl, contentType: "progressive" as const, useCaching: true }),
    [ad.videoUrl],
  );
  const player = useVideoPlayer(source, (p) => {
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SECONDS;
    p.play();
  });

  const sendEvent = useCallback(
    (event: AdPlaybackEvent, positionSeconds?: number) => {
      if (sentRef.current.has(event)) return;
      sentRef.current.add(event);
      // Fire and forget: the server's answer changes nothing on screen, and
      // the film must not wait on it.
      adsApi.sendPlaybackEvent(ad.playbackId, event, positionSeconds).catch(() => {});
    },
    [ad.playbackId],
  );

  const clearStall = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const clearResumeTry = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (reason: PrerollAdFinishReason) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearStall();
      clearResumeTry();
      // The second the ad was at, for Skip and for a failure mid-play; left
      // out when nothing ever ticked — there is no position in a file that
      // never opened.
      sendEvent(reason, currentTimeRef.current > 0 ? currentTimeRef.current : undefined);
      // The screen unmounts this component on the callback below, which
      // releases the player — but a frame of ad audio under the film's first
      // frame is still a frame too many, so it is paused first.
      try {
        player.pause();
      } catch {
        // Already released — nothing left to pause.
      }
      onFinishedRef.current(reason);
    },
    [clearStall, clearResumeTry, sendEvent, player],
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  /** Arms the stall timer unless one is already running — a repeated "loading" must not keep pushing it back. */
  const armStall = useCallback(() => {
    if (stallTimerRef.current) return;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      finishRef.current("failed");
    }, STALL_TIMEOUT_MS);
  }, []);

  // The first load counts as a stall too: armed from mount rather than from
  // the first "loading" event, in case the file never gets that far.
  useEffect(() => {
    armStall();
    return () => {
      clearStall();
      clearResumeTry();
    };
  }, [armStall, clearStall, clearResumeTry]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  /**
   * The player stops when the app leaves the foreground (`staysActiveInBackground`
   * is off) and does not restart by itself. On return it is told to play
   * again; while away the stall timer is stood down, since a player the OS
   * has paused is not stalled, and written off it would be the film starting
   * under a locked screen.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (finishedRef.current) return;
      if (state === "active") {
        player.play();
        if (player.status === "loading") armStall();
      } else {
        clearStall();
        clearResumeTry();
      }
    });
    return () => subscription.remove();
  }, [player, armStall, clearStall, clearResumeTry]);

  /**
   * The OS can also pause the player while the app stays in front: Android's
   * audio-focus manager pauses on a focus loss (another app's audio, a
   * notification sound) and does not resume on regain, and iOS pauses on an
   * interruption (headphones unplugged, a call). The status stays
   * `readyToPlay`, so the stall timer never arms, and the ad's chrome has no
   * play control — the ad would hang for good. So a pause this component did
   * not ask for is answered with one `play()` after a short beat; if that
   * does not take, the stall timer is armed and the film mounts when it
   * fires. Our own pause (`finish`) and the OS taking the app away (the
   * AppState path above) are left alone.
   */
  useEventListener(player, "playingChange", ({ isPlaying }) => {
    if (finishedRef.current) return;
    if (isPlaying) {
      clearResumeTry();
      // Whatever paused it has let go. A stall armed by the retry below has
      // nothing left to time; one armed by "loading" is readyToPlay's to clear.
      if (player.status === "readyToPlay") clearStall();
      return;
    }
    if (AppState.currentState !== "active" || resumeTimerRef.current) return;
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      if (finishedRef.current || AppState.currentState !== "active") return;
      player.play();
      armStall();
    }, RESUME_RETRY_DELAY_MS);
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") {
      finish("failed");
      return;
    }
    if (status === "loading") {
      setBuffering(true);
      armStall();
    } else if (status === "readyToPlay") {
      setBuffering(false);
      clearStall();
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime: time }) => {
    // A clock that moves is the one proof the picture is not stuck. It
    // retires a stall armed before this listener was even attached — a
    // cached file can be ready before the first render commits, so its
    // readyToPlay is never seen here — and a rebuffer's once it is over.
    if (time > currentTimeRef.current) clearStall();
    currentTimeRef.current = time;
    setCurrentTime(time);
  });

  useEventListener(player, "sourceLoad", ({ duration }) => {
    // Same guard as VideoPlayer: a re-emission can carry an unset duration.
    if (duration > 0) setMediaDuration(duration);
  });

  useEventListener(player, "playToEnd", () => finish("completed"));

  /**
   * The impression. The first frame, not `readyToPlay` or `play()`: a file
   * that loaded but never painted was never seen. Guarded on the sent set
   * because Android can fire this again on a mid-play track change — and
   * on `finish` having run, because after a terminal event nothing may be
   * sent: a frame landing just after the stall wrote the play off would
   * otherwise file an impression — and hold this title's next ad back for
   * the admin's "Same movie again" minutes — for an ad the viewer never saw.
   */
  const handleFirstFrame = useCallback(() => {
    if (finishedRef.current || sentRef.current.has("started")) return;
    sendEvent("started");
    // Painted, so it is neither loading nor stalled — whatever a status
    // event that beat the subscription had to say.
    clearStall();
    setBuffering(false);
    setStarted(true);
  }, [sendEvent, clearStall]);

  const total = mediaDuration > 0 ? mediaDuration : ad.durationSeconds;
  const remaining = Math.max(0, Math.ceil(total - currentTime));
  /** Seconds into the ad before Skip may show; null when it never may. */
  const skipAfter = ad.isSkippable ? (ad.skipAfterSeconds ?? 0) : null;
  const canSkip = skipAfter !== null && currentTime >= skipAfter;
  const skipIn = skipAfter !== null ? Math.max(1, Math.ceil(skipAfter - currentTime)) : 0;

  // The same insets PlayerControls uses: fullscreen is edge-to-edge, so the
  // chrome clears the cutout at the sides and the home indicator below;
  // inline (portrait) the stage already sits inside the layout.
  const topOffset = isFullscreen ? 14 + insets.top : 4;
  const sideTop = isFullscreen ? Math.max(36, insets.left, insets.right) : 4;
  const sideBottom = isFullscreen ? Math.max(38, insets.left, insets.right) : 4;
  const bottomOffset = isFullscreen ? 12 + insets.bottom : 4;

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        // As VideoPlayer: a surfaceView is a hardware overlay that can take
        // touches ahead of the chrome drawn over it; textureView composites.
        surfaceType="textureView"
        onFirstFrameRender={handleFirstFrame}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <LinearGradient
          colors={isFullscreen ? SCRIM_TOP_FULL : SCRIM_TOP}
          style={[styles.scrimTop, { height: isFullscreen ? 120 + insets.top : 76 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={isFullscreen ? SCRIM_BOTTOM_FULL : SCRIM_BOTTOM}
          style={[styles.scrimBottom, { height: isFullscreen ? 110 + insets.bottom : 72 }]}
          pointerEvents="none"
        />

        <View style={[styles.row, { top: topOffset, left: sideTop, right: sideTop }]} pointerEvents="box-none">
          <ChromeButton glyph="back" glyphSize={24} label={t.common.back} onPress={onBack} />
          <View style={styles.titleBlock} pointerEvents="none">
            <View style={styles.adTag}>
              <ThemedText
                weight="extrabold"
                color={theme.colors.onPrimary}
                maxFontSizeMultiplier={1.3}
                style={styles.adTagText}
              >
                {t.player.adLabel}
              </ThemedText>
            </View>
            <ThemedText
              weight="bold"
              numberOfLines={1}
              maxFontSizeMultiplier={CHROME_FONT_CAP}
              style={styles.title}
            >
              {ad.title}
            </ThemedText>
          </View>
          <ChromeButton
            glyph={muted ? "muted" : "volume"}
            label={muted ? t.player.unmute : t.player.mute}
            onPress={onToggleMute}
          />
        </View>

        {/* Waiting is the Player's own treatment — pulsing dots in a dark
            pill — labelled "Loading ad…" until the first frame, and bare dots
            for a rebuffer after it. */}
        {(!started || buffering) && <AdLoadingPill isFullscreen={isFullscreen} labelled={!started} />}

        <View
          style={[styles.row, { bottom: bottomOffset, left: isFullscreen ? sideBottom : 14, right: sideBottom }]}
          pointerEvents="box-none"
        >
          <View style={styles.countdownBlock} pointerEvents="none">
            <View style={styles.countdown}>
              <ThemedText
                variant="caption"
                weight="bold"
                tabular
                color={theme.colors.text}
                maxFontSizeMultiplier={CHROME_FONT_CAP}
              >
                {t.player.adEndsIn.replace("{n}", String(remaining))}
              </ThemedText>
            </View>
            {note ? (
              <ThemedText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                color={theme.colors.textBody}
                maxFontSizeMultiplier={CHROME_FONT_CAP}
              >
                {note}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.spacer} pointerEvents="none" />
          {skipAfter !== null &&
            (canSkip ? (
              <Pressable
                onPress={() => finish("skipped")}
                accessibilityRole="button"
                accessibilityLabel={t.player.skipAd}
                style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
              >
                <ThemedText
                  weight="extrabold"
                  color={theme.colors.onPlay}
                  maxFontSizeMultiplier={CHROME_FONT_CAP}
                  style={styles.skipText}
                >
                  {t.player.skipAd}
                </ThemedText>
                <PlayerGlyph name="next" size={16} color={theme.colors.onPlay} />
              </Pressable>
            ) : (
              <View style={styles.skipWait} accessible accessibilityLiveRegion="polite">
                <ThemedText
                  variant="caption"
                  weight="bold"
                  tabular
                  color={theme.colors.textBody}
                  maxFontSizeMultiplier={CHROME_FONT_CAP}
                >
                  {t.player.skipAdIn.replace("{n}", String(skipIn))}
                </ThemedText>
              </View>
            ))}
          <ChromeButton
            glyph={isFullscreen ? "exitFullscreen" : "enterFullscreen"}
            glyphSize={20}
            label={isFullscreen ? t.player.exitFullscreen : t.player.enterFullscreen}
            onPress={onToggleFullscreen}
          />
        </View>
      </View>
    </View>
  );
});

/**
 * The ad's waiting pill — the Player's buffering treatment, labelled "Loading
 * ad…" (or bare dots for a rebuffer once the ad has painted). Exported for the
 * Player's ad breaks, which show it on a black stage while the break's ad is
 * still being decided.
 */
export const AdLoadingPill = memo(function AdLoadingPill({
  isFullscreen,
  labelled = true,
}: {
  isFullscreen: boolean;
  labelled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.center} pointerEvents="none">
      <View
        style={[styles.pill, isFullscreen && styles.pillFull]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t.player.adLoading}
      >
        <BufferingDots size={isFullscreen ? 7 : 6} />
        {labelled && (
          <ThemedText
            variant="caption"
            weight="bold"
            color={theme.colors.text}
            maxFontSizeMultiplier={CHROME_FONT_CAP}
            style={isFullscreen ? styles.pillTextFull : undefined}
          >
            {t.player.adLoading}
          </ThemedText>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  // Anchored to the stage's edges, as PlayerControls' rows are.
  row: { position: "absolute", flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  adTag: {
    alignSelf: "flex-start",
    minHeight: 18,
    paddingHorizontal: 6,
    borderRadius: 4,
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  adTagText: { fontSize: 10, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 14, color: theme.colors.text },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.artBadge,
  },
  pillFull: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22 },
  pillTextFull: { fontSize: 14 },
  // The countdown with the break's note under it, both pinned to the bottom row.
  countdownBlock: { flexShrink: 1, minWidth: 0, gap: 2 },
  countdown: {
    alignSelf: "flex-start",
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: theme.colors.artBadge,
  },
  spacer: { flex: 1 },
  // The one white control, as the play disc is: the eye lands on it.
  skip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: theme.colors.play,
  },
  skipText: { fontSize: 14 },
  skipWait: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  pressed: { opacity: 0.85 },
});

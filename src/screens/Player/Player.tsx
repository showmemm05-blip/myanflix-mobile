import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, StatusBar, Pressable, Share, View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useKeepAwake } from "expo-keep-awake";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SubtitleTrack } from "expo-video";
import { VideoPlayer, type VideoPlayerHandle } from "@/video/VideoPlayer";
import { PlayerControls } from "@/components/player/PlayerControls";
import { SpeedSheet } from "@/components/player/SpeedSheet";
import { QualitySheet } from "@/components/player/QualitySheet";
import { SubtitleSheet } from "@/components/player/SubtitleSheet";
import { SubtitleOverlay } from "@/components/player/SubtitleOverlay";
import { EpisodeSheet } from "@/components/player/EpisodeSheet";
import { LockedOverlay } from "@/components/player/LockedOverlay";
import { EpisodesSection } from "@/components/player/EpisodesSection";
import { MoviePortraitDetails } from "@/components/player/MoviePortraitDetails";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/layout/TopBar";
import { useStreamInfo } from "@/hooks/useVideo";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { useIsInWatchlist, useToggleWatchlist } from "@/hooks/useWatchlist";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useWatchProgressReporter } from "@/video/useWatchProgressReporter";
import { useSubtitleCues } from "@/video/useSubtitleCues";
import { cueLinesAt, type SubtitleCue } from "@/video/subtitleCues";
import { useLanguage } from "@/localization/LanguageProvider";
import { usePlayerPrefsStore } from "@/store/playerPrefsStore";
import {
  findSubtitleTrackByLanguage,
  isSameSubtitleTrackList,
  subtitleTrackKey,
  subtitleTrackTag,
} from "@/video/subtitleTracks";
import { resolveQualityUrl } from "@/video/qualityOptions";
import { clamp } from "@/utils/format";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { StreamSubtitle } from "@/types/video";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const CONTROLS_HIDE_DELAY_MS = 3000;
/** Two taps on the same side within this window count as a double-tap seek. */
const DOUBLE_TAP_MS = 280;
const SEEK_FLASH_MS = 600;
const SKIP_SECONDS = 10;
/**
 * How long a quality switch waits for the new source to report a duration
 * before it gives up on restoring the position. A backstop in the same spirit
 * as VideoPlayer's own SEEK_SETTLE_MS: the resume holds every progress tick
 * until it fires the seek, so a source that never loads would otherwise freeze
 * the scrub bar and the captions for the rest of the sitting. Losing the place
 * is the lesser failure, and generous enough that a slow rendition still lands.
 */
const RESUME_LOAD_TIMEOUT_MS = 15000;

/** Module scope, so "no cues" and "no caption" are the SAME array every tick. */
const EMPTY_LINES: string[] = [];
const EMPTY_CUES: SubtitleCue[] = [];
/** Same rule for "no recommendations": one array, so the memoized rail never sees a fresh empty one. */
const EMPTY_MOVIES: Movie[] = [];

type TapZone = "left" | "center" | "right";

export function PlayerScreen({ route, navigation }: Props) {
  const routeMovieId = route.params.movieId;
  const { t } = useLanguage();
  useKeepAwake();

  /**
   * WHAT IS PLAYING — state, seeded from the route, not read off it every
   * render. Picking the next episode used to `navigation.replace`, which tore
   * this screen down and built a fresh one: the video surface, the episode rail
   * and every query starting from nothing. That teardown is the "refresh" a
   * viewer sees when they only asked for the next episode. One mounted screen
   * now lasts a whole sitting and the episode is swapped inside it; the route
   * is kept in step below so a state restore or a deep link still names what is
   * actually playing.
   */
  const [movieId, setMovieId] = useState(routeMovieId);
  /**
   * The same value, readable from a promise that was started before the
   * viewer changed episode. Anything that resolves late must check this
   * rather than the id it closed over, or it acts on the previous episode.
   */
  const movieIdRef = useRef(movieId);
  movieIdRef.current = movieId;

  const movieQuery = useMovie(movieId);
  const streamQuery = useStreamInfo(movieId);
  const preferredSpeed = usePlayerPrefsStore((s) => s.preferredSpeed);
  const setPreferredSpeed = usePlayerPrefsStore((s) => s.setPreferredSpeed);
  const preferredSubtitleLanguage = usePlayerPrefsStore((s) => s.preferredSubtitleLanguage);
  const setPreferredSubtitleLanguage = usePlayerPrefsStore((s) => s.setPreferredSubtitleLanguage);
  const subtitleSize = usePlayerPrefsStore((s) => s.subtitleSize);
  const subtitleBackground = usePlayerPrefsStore((s) => s.subtitleBackground);
  const preferredQuality = usePlayerPrefsStore((s) => s.preferredQuality);
  const setPreferredQuality = usePlayerPrefsStore((s) => s.setPreferredQuality);
  const insets = useSafeAreaInsets();

  const videoRef = useRef<VideoPlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [speedSheetOpen, setSpeedSheetOpen] = useState(false);
  const [qualitySheetOpen, setQualitySheetOpen] = useState(false);
  const [subtitleSheetOpen, setSubtitleSheetOpen] = useState(false);
  const [episodeSheetOpen, setEpisodeSheetOpen] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  /**
   * The stage's measured size, which the caption overlay needs because the web
   * design sizes and positions the caption in percentages of the video box.
   * Measured rather than derived: `onLayout` is right in portrait (16:9 of the
   * screen) and in fullscreen (the whole frame) without a second formula.
   */
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [seekFlash, setSeekFlash] = useState<TapZone | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  /** One fresh-link attempt per playback failure — see VideoPlayer's onError below. */
  const playbackRecoveryTriedRef = useRef(false);
  /**
   * Whether the source currently pinned has ever reported a duration, i.e. ever
   * actually opened. This is what tells the two kinds of playback failure apart,
   * and they want opposite cures: a rendition missing from storage fails on its
   * FIRST load and wants a different rung, while an expired signed link fails
   * after the picture has been running for hours and wants a fresh link for the
   * SAME rung. Reset below whenever the pin changes, set in `onLoad`.
   */
  const sourceEverLoadedRef = useRef(false);
  /**
   * The second to seek to as soon as the NEXT source finishes loading, or null
   * when there is nothing to restore. Changing quality replaces the player's
   * source, and a fresh player always opens at 0:00 — this is what carries the
   * viewer's place across that rebuild.
   */
  const pendingResumeRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * One drop-to-Auto per pinned link, for a rendition listed in the database
   * whose folder never reached storage: it 404s forever, so retrying it would
   * burn the signed-link recovery attempt on a file that cannot exist. Re-armed
   * by an explicit pick and by a successful refetch, both of which give the
   * ladder a link it has not already failed on.
   */
  const qualityFallbackTriedRef = useRef(false);
  /**
   * Every link this EPISODE has already failed on. Both cures above re-arm each
   * other on a successful refetch, and with a ladder there are now two links
   * that can be swapped between — so without a memory of what has already been
   * tried, a title that cannot play AT ALL (cache server down, token rejected)
   * ping-pongs forever: the rung fails, the drop pins the master, the master
   * fails, the refetch resolves the rung again, and because that link differs
   * from the pinned master the old "the refetch handed back the very same URL"
   * test never fires. This is that test generalised from one link to all of
   * them, and it is what makes the error eventually reach the viewer instead of
   * a buffering pill that never clears.
   *
   * A link is only ever equal to itself within one signing hour, so a genuinely
   * newly signed link is never blocked by this — it is not in the set, and it
   * gets the fresh try it deserves.
   */
  const failedSourcesRef = useRef<Set<string>>(new Set());
  /** The subtitle link a fresh response has already been asked for — see below. */
  const cueRecoveryUrlRef = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; zone: TapZone } | null>(null);
  const seekFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { updatePosition, reportNow } = useWatchProgressReporter(movieId, duration);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [scheduleHide]);

  useEffect(() => {
    return () => {
      if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  // Always restore portrait + orientation auto-unlock on leaving the player,
  // regardless of whether the user toggled fullscreen.
  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  /**
   * The ONE watch-history refetch per sitting. Every progress report only
   * marks the list stale now (useReportWatchProgress), because reporting runs
   * every 15s and the Watch-history screen is still mounted underneath this
   * modal. Leaving the player is the moment a new resume point is worth a
   * request, so it is spent here.
   *
   * Known and accepted: the reporter's own unmount flush is registered above
   * this one and its PATCH is still in flight when this refetch goes out, so
   * the list can come back holding the position from a few seconds earlier.
   * It stays marked stale by that flush, so the next visit shows the truth.
   */
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      queryClient.invalidateQueries({ queryKey: ["watch-history"] });
    },
    [queryClient],
  );

  const exitFullscreen = useCallback(async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    setIsFullscreen(false);
    scheduleHide();
  }, [scheduleHide]);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      setIsFullscreen(true);
      scheduleHide();
    }
  };

  /**
   * Android's back button means "leave fullscreen" here, not "close the
   * player". Without this it popped the whole screen — losing the video
   * surface, the buffer and the rail — for what the viewer meant as a
   * one-tap return to portrait. Returning false in portrait lets the normal
   * back action through untouched, on this screen and on every other one:
   * this is the app's only hardware-back listener and it only claims the
   * event while fullscreen is actually on.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isFullscreen) return false;
      void exitFullscreen();
      return true;
    });
    return () => subscription.remove();
  }, [isFullscreen, exitFullscreen]);

  const toggleControls = () => {
    setControlsVisible((visible) => {
      const next = !visible;
      if (next) scheduleHide();
      return next;
    });
  };

  const handleTogglePlay = () => {
    setIsPlaying((playing) => {
      const next = !playing;
      if (!next) reportNow();
      return next;
    });
    scheduleHide();
  };

  const handleSkip = (delta: number) => {
    const target = clamp(position + delta, 0, duration);
    videoRef.current?.seek(target);
    setPosition(target);
    updatePosition(target);
    reportNow();
    scheduleHide();
  };

  const handleSeek = (seconds: number) => {
    videoRef.current?.seek(seconds);
    setPosition(seconds);
    updatePosition(seconds);
    reportNow();
    scheduleHide();
  };

  const handleBack = () => {
    reportNow();
    navigation.goBack();
  };

  const handleSelectSpeed = (speed: number) => {
    setPreferredSpeed(speed);
  };

  /**
   * Which subtitle is showing is DERIVED, never a second piece of state: a
   * language is the single source of truth, resolved against whatever this
   * particular title offers. So there is nothing to keep in sync when the list
   * arrives late, and a title without that language just plays without
   * subtitles instead of silently clearing the preference.
   *
   * Which language depends on whether the viewer has ever chosen. `undefined`
   * means they have not, and then the title's own default wins — matching the
   * web client, where hls.js auto-selects it. Only an explicit `null` ("Off")
   * suppresses it. Conflating the two is what made a fresh install turn the
   * default track off.
   */
  const defaultSubtitleLanguage =
    streamQuery.data?.status === "ready" ? streamQuery.data.defaultSubtitleLanguage : null;
  const subtitleLanguage =
    preferredSubtitleLanguage === undefined ? defaultSubtitleLanguage : preferredSubtitleLanguage;

  const streamSubtitles = useMemo(
    () => (streamQuery.data?.status === "ready" ? streamQuery.data.subtitles : []),
    [streamQuery.data],
  );

  const activeSubtitle = useMemo(
    () => findSubtitleTrackByLanguage(streamSubtitles, subtitleLanguage),
    [streamSubtitles, subtitleLanguage],
  );

  /**
   * The captions are drawn by this screen, from the subtitle file itself —
   * expo-video reports no cues at all, and its own renderer cannot be styled
   * or moved clear of the control bar. See SubtitleOverlay.
   */
  const cuesQuery = useSubtitleCues(activeSubtitle);
  /**
   * The tick moves 4x/s; the caption changes every few seconds. Holding the
   * previous array whenever the visible text is identical lets the memoized
   * overlay re-render once per caption instead of once per tick. Writing the
   * ref during render is impure, but the value it holds is equality-preserving
   * — the same lines either way — so nothing downstream can observe the order.
   */
  const linesRef = useRef<string[]>(EMPTY_LINES);
  const subtitleLines = useMemo(() => {
    const next = cueLinesAt(cuesQuery.data ?? EMPTY_CUES, position);
    const prev = linesRef.current;
    if (prev.length === next.length && prev.every((line, i) => line === next[i])) return prev;
    linesRef.current = next;
    return next;
  }, [cuesQuery.data, position]);

  /**
   * The one case where the native renderer is allowed to paint: the cue file
   * could not be read (dead link, unreadable file), so rather than let the
   * subtitles simply vanish, the matching manifest rendition is switched on
   * and the overlay stands down. An ASS subtitle has no rendition to fall back
   * to — it is deliberately kept out of the manifest — so that one really does
   * go quiet until a fresh link parses.
   *
   * IT IS UNAVAILABLE WHILE A NAMED QUALITY IS PINNED, and knowingly so: a
   * rendition's own playlist is a MEDIA playlist, and `#EXT-X-MEDIA:TYPE=
   * SUBTITLES` lines live only in the master, so `subtitleTracks` is empty and
   * this resolves to null. Captions themselves are unaffected — the overlay
   * reads the API's subtitle rows, which are per-MOVIE and have nothing to do
   * with which playlist is mounted — but a cue file that cannot be read has
   * nothing left to cover for it. Accepted rather than engineered around: it is
   * a fallback of a fallback, and the cure is one tap, Auto, which brings the
   * manifest's text renditions back.
   */
  const nativeFallbackTrack = useMemo(
    () => (cuesQuery.isError ? findSubtitleTrackByLanguage(subtitleTracks, subtitleLanguage) : null),
    [cuesQuery.isError, subtitleTracks, subtitleLanguage],
  );

  /**
   * Only fullscreen needs these: there the stage is edge-to-edge, so the
   * caption has to clear the home indicator and the cutout the same way
   * PlayerControls insets itself. In portrait the stage sits inside the layout
   * already and the website had nothing to clear at all.
   */
  const captionInsets = useMemo(
    () =>
      isFullscreen
        ? { bottom: insets.bottom, left: insets.left, right: insets.right }
        : { bottom: 0, left: 0, right: 0 },
    [isFullscreen, insets.bottom, insets.left, insets.right],
  );

  /**
   * The renditions are reported more than once — `sourceLoad` fires before the
   * player has finished parsing the master playlist, then
   * `availableSubtitleTracksChange` fires (possibly repeatedly) as they appear
   * — and every report allocates new objects. Dropping the equal ones stops a
   * pointless re-render of the whole player on top of the progress tick.
   *
   * The list is still tracked even though the picker no longer shows it: it is
   * what `subtitleTracksReady` is derived from (VideoPlayer can only assert a
   * selection once the tracks exist, including the `null` that keeps the
   * native renderer off), and it is what the fallback above matches against.
   */
  const handleSubtitleTracksChange = useCallback((tracks: SubtitleTrack[]) => {
    setSubtitleTracks((current) => (isSameSubtitleTrackList(current, tracks) ? current : tracks));
  }, []);

  const handleSelectSubtitle = (track: StreamSubtitle | null) => {
    setPreferredSubtitleLanguage(track ? subtitleTrackKey(track) : null);
  };

  /**
   * The link the video is MOUNTED on, pinned here instead of read straight off
   * the query. `playlistUrl` is expo-video's source, so replacing it rebuilds
   * the player and the film starts again at 0:00 — the price of recovering
   * playback that has already stopped, and far too high for anything else.
   * A dead caption link refetches the same stream response, and once the
   * signing hour has rolled over that response carries a different playlist
   * URL; without this pin, a subtitle file that would not load would throw a
   * perfectly healthy picture back to the beginning. Only the playback-error
   * path below adopts what a refetch returns.
   *
   * It pins against a REFETCH of the episode being watched, never against the
   * sitting: switching episodes clears it (see `resetEpisodeState`) and the
   * effect then pins the new episode's link the moment its response lands.
   * Starting the new episode at 0:00 is the point there, not the price.
   */
  const [pinnedPlaylistUrl, setPinnedPlaylistUrl] = useState<string | null>(null);
  const readyPlaylistUrl = streamQuery.data?.status === "ready" ? streamQuery.data.playlistUrl : null;

  /**
   * The ladder, and which rung SHOULD be mounted — both derived, never a second
   * piece of state, the same discipline `activeSubtitle` follows. The stored
   * label is the single source of truth and it is resolved against whatever
   * this particular title offers, so there is nothing to keep in sync when a
   * response lands late and nothing to clear when a title has no such rung.
   */
  const qualities = useMemo(
    () => (streamQuery.data?.status === "ready" ? streamQuery.data.qualities : []),
    [streamQuery.data],
  );
  /**
   * A rung this EPISODE has already proved it cannot play — listed in the
   * database, missing from storage. Suspending it here rather than clearing the
   * stored preference is the whole difference between "this episode has no
   * working 720p" and "this viewer no longer wants 720p": one bad folder must
   * not cost a choice that lives in AsyncStorage and applies to every other
   * title. Cleared when the episode changes, and when the viewer picks again.
   */
  const [unplayableQuality, setUnplayableQuality] = useState<string | null>(null);
  /**
   * The remembered choice as it applies HERE — the stored label, unless this
   * episode has already failed on it.
   */
  const effectiveQuality = preferredQuality === unplayableQuality ? null : preferredQuality;
  const desiredPlaylistUrl = readyPlaylistUrl
    ? resolveQualityUrl(readyPlaylistUrl, qualities, effectiveQuality)
    : null;
  /**
   * The rung actually playing — the remembered label only counts once THIS
   * title turns out to have it, and to be playable. Undefined means Auto,
   * whether that is the choice, a title without the rung, or a rung that
   * failed, and all three are the truth the badge and the checkmark have to
   * tell.
   */
  const activeQuality =
    effectiveQuality === null ? undefined : qualities.find((q) => q.label === effectiveQuality);

  // Pinning the DESIRED rung rather than the master matters on first mount with
  // a remembered "720p": the screen opens straight onto that rendition, with no
  // swap, no resume seek and no moment of Auto to flash past.
  useEffect(() => {
    setPinnedPlaylistUrl((current) => current ?? desiredPlaylistUrl);
  }, [desiredPlaylistUrl]);

  // A new source has not opened yet, by definition. Keyed on the pin so it
  // covers every route that swaps the source — the viewer's pick, the drop to
  // Auto, and the freshly signed link recovery adopts.
  useEffect(() => {
    sourceEverLoadedRef.current = false;
  }, [pinnedPlaylistUrl]);

  /** Stop waiting for the next source to load — the resume is off. */
  const clearResumeWait = useCallback(() => {
    pendingResumeRef.current = null;
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  }, []);

  /**
   * Remembers the second the NEXT player should open at, because a source
   * change always starts a fresh one at 0:00. Nothing is remembered from the
   * first second of a film, or from a source that never reported a duration —
   * there is no place to lose there.
   *
   * The position comes from React state — the last SETTLED tick — never from
   * the player, so a switch made mid-buffer still lands where the viewer was
   * looking, and one made mid-seek lands on the seek TARGET the scrub handler
   * already wrote optimistically.
   *
   * Declared above the recovery path below because that path captures too: a
   * link that expired mid-film is the one case where the viewer was deep into
   * something and would most resent starting over.
   */
  const captureResume = useCallback(() => {
    clearResumeWait();
    if (duration <= 0 || position < 1) return;
    pendingResumeRef.current = position;
    resumeTimeoutRef.current = setTimeout(clearResumeWait, RESUME_LOAD_TIMEOUT_MS);
  }, [duration, position, clearResumeWait]);

  /**
   * The playlist URL carries a signed token that expires (the cache server
   * answers 410 past it), so a fresh link is worth one try before the error
   * reaches the viewer. A link this episode has ALREADY failed on coming back
   * means this was not an expiry at all, and the caller decides what to show
   * for it — see `failedSourcesRef`.
   */
  const refetchStream = streamQuery.refetch;
  const recoverPlayback = useCallback(
    (onGiveUp: () => void) => {
      if (playbackRecoveryTriedRef.current) {
        onGiveUp();
        return;
      }
      playbackRecoveryTriedRef.current = true;
      // The episode this attempt belongs to. The screen now survives an
      // episode change, so a refetch started for the outgoing episode can
      // still settle after the viewer has moved on — and without this check
      // its freshly signed link would be pinned as the source for, or its
      // failure shown over, the episode now playing.
      const recoveringId = movieId;
      // Captured NOW rather than when the response lands, so the second that is
      // restored is the one the picture died on.
      const resumeFrom = duration > 0 && position >= 1 ? position : null;
      // Which rung the fresh response should be resolved against, decided HERE
      // while the ref still describes the source that just died.
      //
      // Normally the STORED label, so a rung the drop to Auto below suspended
      // is reinstated: reaching this path at all means the master failed too,
      // and an outage that takes down every link says nothing about a rung. A
      // viewer watching 720p when the token expired comes back on 720p.
      //
      // The exception is a source that HAD been playing. Then the master was
      // working right up to this failure, so a suspension standing against a
      // rung was earned by that rung alone, and the master's own expiry must
      // not smuggle the broken rung back in behind a fresh link.
      const recoverLabel = sourceEverLoadedRef.current ? effectiveQuality : preferredQuality;
      refetchStream()
        .then((result) => {
          if (recoveringId !== movieIdRef.current) return;
          // Resolved against the FRESH response's own ladder — the rung URLs
          // and the master are signed together and expire together, so the
          // whole ladder is renewed by this one refetch.
          const fresh =
            result.data?.status === "ready"
              ? resolveQualityUrl(result.data.playlistUrl, result.data.qualities, recoverLabel)
              : undefined;
          // A link already known not to open is not a recovery, whether it is
          // the one still pinned (a refetch inside the same signing hour hands
          // back the very same URL) or the other rung this failure has been
          // alternating with.
          if (!fresh || failedSourcesRef.current.has(fresh)) {
            onGiveUp();
            return;
          }
          // Playback had already stopped, so rebuilding the player on the new
          // link is the only way back — but not from 0:00 any more: the same
          // pending-resume the quality switch uses carries the place across
          // this rebuild too, and gives up quietly after RESUME_LOAD_TIMEOUT_MS
          // if the new link cannot open either.
          if (resumeFrom !== null) {
            clearResumeWait();
            pendingResumeRef.current = resumeFrom;
            resumeTimeoutRef.current = setTimeout(clearResumeWait, RESUME_LOAD_TIMEOUT_MS);
          }
          // Only lifted when the rung is what was actually reinstated. Lifting
          // it while mounting the master would leave the badge claiming a
          // quality that is not playing — the one thing the suspension exists
          // to prevent.
          if (recoverLabel === preferredQuality) setUnplayableQuality(null);
          setPinnedPlaylistUrl(fresh);
          // Arm one more attempt of each so the NEXT expiry in a long sitting
          // recovers the same way rather than surfacing the error, and so a
          // freshly signed rung is judged on its own merits rather than on a
          // verdict reached against an expired link. Re-arming cannot loop:
          // every cure now refuses a link already in `failedSourcesRef`.
          playbackRecoveryTriedRef.current = false;
          qualityFallbackTriedRef.current = false;
        })
        .catch(() => {
          if (recoveringId !== movieIdRef.current) return;
          onGiveUp();
        });
    },
    [
      refetchStream,
      movieId,
      preferredQuality,
      effectiveQuality,
      duration,
      position,
      clearResumeWait,
    ],
  );

  /**
   * Changing quality means changing the playlist the player is mounted on —
   * "Auto" is the master, a named rung is that rendition's own media playlist.
   * There is no other way: expo-video cannot be told to hold a video track.
   */
  const handleSelectQuality = (label: string | null) => {
    const next = readyPlaylistUrl ? resolveQualityUrl(readyPlaylistUrl, qualities, label) : null;
    // Picking what is already playing changes nothing on the player — and the
    // preference is only written when the viewer actually chose something
    // else. Tapping the checked Auto row on a title whose remembered rung is
    // missing or broken would otherwise throw that rung away everywhere, which
    // is not what "Auto is already selected here" means.
    if (!next || next === pinnedPlaylistUrl) {
      if (label !== (activeQuality?.label ?? null)) setPreferredQuality(label);
      return;
    }
    // First, while the reporter still holds a true position — the same ordering
    // an episode change uses.
    reportNow();
    captureResume();
    setPreferredQuality(label);
    // An explicit pick retires whatever verdict this episode reached on its
    // own: the viewer is asking for this rung now, and if it is still the
    // broken one the drop below will simply say so again.
    setUnplayableQuality(null);
    // REPLACED, never cleared: `sourceUrl` therefore never goes null, so the
    // stage, the controls, the rail and the caption overlay all stay mounted,
    // and only the picture goes away while the new rendition opens.
    setPinnedPlaylistUrl(next);
    // On the same commit as the swap, so the buffering pill is already there
    // rather than arriving a `statusChange` later.
    setIsBuffering(true);
    // The list belongs to the manifest being discarded. A single rendition's
    // playlist declares no text renditions at all, so a track left over from
    // the master would be a selection asserted onto a player that has none.
    setSubtitleTracks([]);
    // A different rung is worth its own drop-to-Auto below, and only that: a
    // deliberate switch is not a failure, so the signed-link recovery
    // bookkeeping is left alone — it neither spends an attempt nor gains one.
    qualityFallbackTriedRef.current = false;
  };

  /**
   * The answer to a rung that NEVER OPENED: drop to Auto. A rendition can be
   * listed in the database and missing from storage — the bulk path validates,
   * the transcode path does not re-verify after upload — and such a rung 404s
   * for good, so spending the one signed-link attempt on it recovers nothing.
   * The master is the one playlist known to work, being what played before the
   * viewer chose.
   *
   * It must NOT take an error from a source that had been playing. That failure
   * is an expired token, which kills the master exactly as dead as the rung, so
   * switching rungs cures nothing and the fresh-link path above is the only way
   * back — this is what `sourceEverLoadedRef` is for.
   *
   * The rung is suspended for this episode rather than erased from the store:
   * see `unplayableQuality`. The badge stays honest either way, because it
   * reads `activeQuality`, which is resolved through the same suspension.
   *
   * Returns whether it took the error; only if it did not does recovery run.
   */
  const dropToAutoAfterError = useCallback(() => {
    if (qualityFallbackTriedRef.current) return false;
    if (effectiveQuality === null || !readyPlaylistUrl) return false;
    // Already on the master — the failure is not the ladder's doing.
    if (pinnedPlaylistUrl === readyPlaylistUrl) return false;
    // It played, so it exists: this is an expiry, not a missing folder.
    if (sourceEverLoadedRef.current) return false;
    qualityFallbackTriedRef.current = true;
    captureResume();
    setUnplayableQuality(effectiveQuality);
    setPinnedPlaylistUrl(readyPlaylistUrl);
    setIsBuffering(true);
    setSubtitleTracks([]);
    return true;
  }, [effectiveQuality, readyPlaylistUrl, pinnedPlaylistUrl, captureResume]);

  /**
   * A caption link dies on the same ~12h schedule and gets the same cure — ask
   * the API once for a fresh response — but with its OWN bookkeeping, never
   * the playback attempt above. Sharing one flag meant a cue fetch that failed
   * (they share a network blip, and the cue query does not retry) spent the
   * single playback try, leaving a later genuine expiry to give up instantly
   * and show an error without ever asking for a fresh link.
   *
   * Tracked per LINK rather than per screen: each newly signed URL is worth an
   * attempt of its own, and a URL already known to fail is never asked about
   * twice — a refetch inside the same signing hour hands back the very same
   * link. Silent by design, too: the video is playing, so nothing here may
   * surface `playbackError`, and on the master the native rendition covers for
   * the overlay meanwhile — though on a pinned rendition there is no such cover
   * to be had; see `nativeFallbackTrack`.
   */
  const activeSubtitleUrl = activeSubtitle?.url ?? null;
  useEffect(() => {
    if (!cuesQuery.isError || !activeSubtitleUrl) return;
    if (cueRecoveryUrlRef.current === activeSubtitleUrl) return;
    cueRecoveryUrlRef.current = activeSubtitleUrl;
    refetchStream().catch(() => {});
  }, [cuesQuery.isError, activeSubtitleUrl, refetchStream]);

  /**
   * `popTo`, NOT `navigate`. The player is a root-level fullScreenModal above
   * the tab shell, and in react-navigation 7 `navigate("Main", …)` from here
   * PUSHES a second MainTabNavigator — a tab bar drawn over a video that keeps
   * playing, because this screen is never unmounted and nothing pauses it on
   * blur. `popTo` closes the player, returns to the tab shell already
   * underneath, and pushes Subscribe there; one back press then returns to
   * whatever that tab was showing. Watch position is still flushed by
   * useWatchProgressReporter's unmount effect.
   *
   * Subscribe is pushed on the HOME stack specifically, so a locked title
   * opened from the Media or Library tab finishes on Home rather than back on
   * its own tab. Accepted rather than missed: the alternative is registering
   * Subscribe on the root stack, and that one instance would then lose the
   * floating tab bar it is padded for (theme.layout.tabBarClearance) — a
   * visible regression to fix an edge of a history bug.
   */
  const handleSubscribe = () =>
    navigation.popTo("Main", { screen: "HomeTab", params: { screen: "Subscribe" } });

  /**
   * Whether this sitting has ever had a picture. Until it has, waiting is
   * allowed to own the screen. After it, an episode swap keeps the screen, its
   * chrome and the rail exactly where they are and waits behind the buffering
   * treatment instead — dropping back to a full-screen spinner is the same
   * "reload" that switching in place set out to remove.
   */
  const [hasStage, setHasStage] = useState(false);

  /**
   * The series outlives the episode, so it is remembered rather than read fresh
   * every time. `useMovie` is keyed on the EPISODE, so for the renders between
   * a swap and the new episode's details landing there is no `seriesId` at all
   * — and letting the rail fall out of the tree for those renders unmounts it,
   * losing its scroll position and flashing exactly the blank the swap avoids.
   * Cleared only when the route sends this screen to a different title.
   */
  const [sessionSeriesId, setSessionSeriesId] = useState<string | null>(null);
  const loadedSeriesId = movieQuery.data?.seriesId ?? null;
  useEffect(() => {
    if (loadedSeriesId) setSessionSeriesId(loadedSeriesId);
  }, [loadedSeriesId]);

  /**
   * The portrait panel under a film — favourite, share and the recommended
   * rail. All of it is the wiring MovieDetails already has, keyed on what is
   * PLAYING rather than on the route, so an in-place swap re-derives it.
   */
  const isFavorite = useIsInWatchlist(movieId);
  const toggleWatchlist = useToggleWatchlist();
  // Read here, not from the stream: the player only learns a title is locked
  // when its stream answers "forbidden", which is AFTER an in-place swap has
  // already unmounted the film being watched. The rail has to decide from
  // the card's own accessType before it swaps anything — see handlePlaySimilar.
  const subscriptionQuery = useSubscriptionStatus();
  const { mutate: toggleWatchlistMutate } = toggleWatchlist;
  const handleToggleFavorite = useCallback(() => toggleWatchlistMutate(movieId), [toggleWatchlistMutate, movieId]);
  // The title alone, not the record: a refetch hands back a structurally new
  // record with the same title, and this handler need not change for it.
  const movieTitle = movieQuery.data?.title;
  const handleShare = useCallback(() => {
    if (movieTitle) Share.share({ message: movieTitle }).catch(() => {});
  }, [movieTitle]);

  // Not asked until the film's own category is known, and never for an
  // episode — the series rail takes that space. See MovieDetails for why the
  // key must not start category-less.
  const similarCategoryId = movieQuery.data?.categories[0]?.id;
  const similarQuery = useMovies(
    { categoryId: similarCategoryId, limit: 10 },
    { enabled: !!similarCategoryId && !loadedSeriesId },
  );
  /**
   * Memoized, and never a fresh empty array: this feeds the memoized rail
   * through a memoized panel, and a new reference per tick would re-render
   * both four times a second. The placeholder guard is MovieDetails' — while
   * a swap's new key loads, `keepPreviousData` would hold the OLD film's
   * category under a "Recommended" heading, and a held-over list with tappable
   * cards is a wrong list, not a slow one. Re-derived on the new film: the
   * key follows its category and the filter its id.
   */
  const similarMovies = useMemo(() => {
    if (similarQuery.isPlaceholderData) return EMPTY_MOVIES;
    const items = similarQuery.data?.items;
    if (!items || items.length === 0) return EMPTY_MOVIES;
    return items.filter((m) => m.id !== movieId);
  }, [similarQuery.isPlaceholderData, similarQuery.data, movieId]);

  /**
   * Everything that belongs to ONE episode, cleared in ONE place. Anything left
   * behind here is shown by the new episode as if it were its own: the old
   * progress bar and duration, the old captions, the old playback error, a
   * recovery attempt already spent. The pinned link goes too — see its comment
   * above — so the incoming episode's stream is what gets mounted.
   */
  const resetEpisodeState = useCallback(() => {
    setIsPlaying(true);
    setPosition(0);
    setBuffered(0);
    setDuration(0);
    setSubtitleTracks([]);
    setPinnedPlaylistUrl(null);
    setPlaybackError(null);
    setIsBuffering(true);
    setSeekFlash(null);
    if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    // Tap bookkeeping belongs to the episode that was on screen: a pending
    // single-tap would otherwise toggle the controls, and a remembered first
    // tap would pair with a tap on the new episode into a phantom seek.
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    lastTapRef.current = null;
    playbackRecoveryTriedRef.current = false;
    cueRecoveryUrlRef.current = null;
    // A resume left pending by a quality switch belongs to the episode going
    // off — honouring it would seek the NEW episode to the OLD one's second.
    // The new episode starts at 0:00 by design; the remembered quality still
    // applies to it, through the pin effect above.
    clearResumeWait();
    qualityFallbackTriedRef.current = false;
    // Links are per-episode (the movie id is in the path), so nothing here
    // could ever match the incoming episode's — but the set would otherwise
    // grow for the whole of a series sitting, and this is the one place
    // episode-scoped bookkeeping is dropped.
    failedSourcesRef.current.clear();
    // A rung the OUTGOING episode could not play says nothing about this one:
    // each episode is transcoded on its own, so the remembered quality gets a
    // clean hearing here.
    setUnplayableQuality(null);
    // The reporter is about to be re-keyed to the new episode, and it reports
    // from a ref the video ticks into. Zeroing it is what stops the outgoing
    // episode's seconds being written against the incoming episode's id by the
    // next 15s tick, before the new picture has reported a position of its own.
    updatePosition(0);
  }, [updatePosition, clearResumeWait]);

  const playEpisode = useCallback(
    (episodeId: string) => {
      setMovieId(episodeId);
      resetEpisodeState();
      setEpisodeSheetOpen(false);
    },
    [resetEpisodeState],
  );

  /**
   * The route is FOLLOWED, not owned. `setParams` below echoes straight back
   * through `route.params`, and adopting that echo would reset the episode a
   * second time — so the last value this screen itself wrote is remembered, and
   * only a value it did not write (a deep link, a state restore, a fresh
   * navigate onto the already-mounted Player) counts as a request to switch.
   */
  const routeEpisodeRef = useRef(routeMovieId);

  /**
   * The in-place swap itself, shared by the episode rail and the recommended
   * rail below: the mounted screen keeps its stage, chrome and lists, and only
   * what is playing changes. Deliberately keyed on nothing that moves with
   * playback, so the handlers built on it stay stable across the tick.
   */
  const switchTitle = useCallback(
    (nextId: string) => {
      // First, while the reporter is still keyed to the outgoing title.
      reportNow();
      playEpisode(nextId);
      routeEpisodeRef.current = nextId;
      // `setParams` rewrites the params of the route already on screen: no new
      // screen, no teardown, no transition. That is the whole difference from
      // the `navigation.replace` this used to do.
      navigation.setParams({ movieId: nextId });
    },
    [reportNow, playEpisode, navigation],
  );

  /**
   * Memoized because the rail below renders it: this screen re-renders four
   * times a second off the playback tick, and a fresh callback each time would
   * rebuild every episode row along with it.
   */
  const handleSelectEpisode = useCallback(
    (episodeId: string) => {
      if (episodeId === movieId) {
        setEpisodeSheetOpen(false);
        return;
      }
      switchTitle(episodeId);
    },
    [movieId, switchTitle],
  );

  /**
   * A recommended film plays IN PLACE — the episode swap above, applied to a
   * standalone film. No navigation: `navigation.replace` was the "refresh"
   * the `movieId` state exists to remove, and a push would stack a second
   * player over a video that keeps playing underneath.
   *
   * The rail already excludes the playing film, so the same-id case cannot
   * arise from a tap; the guard is for a card tapped in the render between a
   * swap and the rail catching up. The cache is seeded from the card's record
   * first — the catalogue list and the detail endpoint serve the same shape —
   * so the panel shows the new film's details on the very next render instead
   * of falling out of the tree until its request lands. (`useMovie` does not
   * refetch on the swap itself: the seed stamps a fresh dataUpdatedAt and the
   * app-wide staleTime floor applies; it refetches on a later mount once stale.)
   *
   * ONE CASE MUST NOT SWAP: a film this viewer cannot stream. The player only
   * learns a title is locked when its STREAM answers "forbidden" — after the
   * swap has already torn down the film being watched — and LockedOverlay's
   * Back then closes the player, so the viewer loses their film to a card
   * they could not play. So a locked (or unpublished) card goes to its
   * details page instead, whose Watch button is already gated by the same
   * hasAccess() and offers Subscribe. The rail keeps showing premium titles
   * to free viewers on purpose: hiding them would hide the upsell.
   */
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const handlePlaySimilar = useCallback(
    (next: Movie) => {
      if (next.id === movieId) return;
      if (!hasAccess(next.accessType, isSubscribed) || next.status !== "PUBLISHED") {
        // popTo, not navigate: the same reasoning as handleSubscribe above —
        // from this root modal, navigate("Main") would push a second tab
        // shell over a video that keeps playing underneath.
        navigation.popTo("Main", {
          screen: "HomeTab",
          params: { screen: "MovieDetails", params: { movieId: next.id } },
        });
        return;
      }
      queryClient.setQueryData<Movie>(["movie", next.id], (current) => current ?? next);
      switchTitle(next.id);
    },
    [movieId, isSubscribed, navigation, queryClient, switchTitle],
  );

  useEffect(() => {
    if (routeMovieId === routeEpisodeRef.current) return;
    routeEpisodeRef.current = routeMovieId;
    reportNow();
    playEpisode(routeMovieId);
    // A route change can point anywhere, including a standalone film, so the
    // remembered series may no longer be true of what is playing.
    setSessionSeriesId(null);
  }, [routeMovieId, playEpisode, reportNow]);

  const flashSeek = (zone: TapZone) => {
    setSeekFlash(zone);
    if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), SEEK_FLASH_MS);
  };

  const cancelPendingSingleTap = () => {
    if (singleTapTimer.current) {
      clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
    }
  };

  /**
   * Single tap and double tap are mutually exclusive: on the side zones the
   * controls toggle is held for the double-tap window, so a seek never flashes
   * the controls on its way past. The centre zone can never start a seek, so it
   * toggles immediately. The seek itself is the same `handleSkip` the skip
   * buttons call — no new playback path.
   */
  const handleZoneTap = (zone: TapZone) => {
    if (zone === "center") {
      cancelPendingSingleTap();
      lastTapRef.current = null;
      toggleControls();
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.zone === zone && now - last.time < DOUBLE_TAP_MS) {
      cancelPendingSingleTap();
      lastTapRef.current = null;
      handleSkip(zone === "left" ? -SKIP_SECONDS : SKIP_SECONDS);
      flashSeek(zone);
      return;
    }

    cancelPendingSingleTap();
    lastTapRef.current = { time: now, zone };
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      lastTapRef.current = null;
      toggleControls();
    }, DOUBLE_TAP_MS);
  };

  /**
   * A full-screen gate is only ever right for a screen with nothing to show.
   * Before the first picture that is still true, so waiting owns the screen as
   * it always did. During an episode swap the queries are loading again — but
   * taking the screen away then would blank the chrome and the rail, which is
   * the reload the viewer complained about, so the render carries on and the
   * buffering treatment over the stage covers the wait instead.
   *
   * A genuine failure still gets its gate: the two below run only once the
   * stream query has settled on an answer, so they cannot fire mid-swap.
   */
  if ((movieQuery.isLoading || streamQuery.isLoading) && !hasStage) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!streamQuery.isLoading && streamQuery.data?.status === "forbidden") {
    return (
      <View style={styles.gate}>
        <StatusBar hidden={false} />
        <LockedOverlay onSubscribe={handleSubscribe} />
        <TopBar transparent onBack={() => navigation.goBack()} />
      </View>
    );
  }

  if (!streamQuery.isLoading && (!streamQuery.data || streamQuery.data.status !== "ready")) {
    const message = streamQuery.isError ? t.common.somethingWentWrong : t.movie.notReady;
    return (
      <View style={styles.center}>
        <View style={styles.messageTile}>
          <Ionicons name="alert-circle-outline" size={28} color={theme.colors.textMuted} />
        </View>
        <ThemedText variant="body" style={styles.centerText}>
          {message}
        </ThemedText>
        <Button title={t.common.back} variant="outline" icon="chevron-back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const movie = movieQuery.data;
  const seriesId = loadedSeriesId ?? sessionSeriesId;
  /**
   * Null only while an episode swap waits for its stream: the stage, and every
   * layer over it, stays mounted with no video in it rather than the screen
   * going away. The old episode's player is gone by then — nothing plays under
   * the spinner.
   */
  const sourceUrl =
    pinnedPlaylistUrl ?? (streamQuery.data?.status === "ready" ? streamQuery.data.playlistUrl : null);
  const showBuffering = !playbackError && (isBuffering || !sourceUrl);
  const showEpisodesRail = !!seriesId && !isFullscreen;
  const episodeLabel =
    movie?.seasonNumber && movie?.episodeNumber
      ? `S${movie.seasonNumber} · E${movie.episodeNumber}`
      : undefined;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Hiding the status bar does not move the physical cutout: in portrait
          the stage starts at y=0, so without this spacer the controls' back
          button and title sit under the notch / Dynamic Island. Fullscreen
          keeps the frame edge-to-edge — its controls inset themselves. */}
      {!isFullscreen && <View style={{ height: insets.top }} />}

      <View
        style={isFullscreen ? styles.stageFull : styles.stage}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setStageSize((current) => (current.width === width && current.height === height ? current : { width, height }));
          // Latched HERE, from the stage existing, rather than from the stream
          // response landing: the two queries race on a first open, and
          // latching on the faster one released the waiting screen while the
          // title and the episode rail were still missing, so they popped in
          // afterwards and shifted the layout. The stage can only lay out once
          // the gate below has already released, which keeps a first open
          // exactly as it was while still protecting an episode swap.
          setHasStage(true);
        }}
      >
        {sourceUrl && (
          <VideoPlayer
            ref={videoRef}
            // Keyed on the EPISODE, not the link: a fresh signed link for the
            // same episode must keep this instance, because that is the
            // recovery path above doing its work. A different episode is a
            // different sitting for the player and gets a clean one, with none
            // of the previous episode's in-flight seek or subtitle bookkeeping.
            key={movieId}
            playlistUrl={sourceUrl}
            paused={!isPlaying}
            rate={preferredSpeed}
            volume={1}
            muted={muted}
            subtitleTrack={nativeFallbackTrack}
            subtitleTracksReady={subtitleTracks.length > 0}
            onSubtitleTracksChange={handleSubtitleTracksChange}
            onProgress={({ currentTime, bufferedSeconds }) => {
              // A player rebuilt for a quality switch ticks 0:00 before it has
              // been seeked back. Letting those through would rewind the scrub
              // bar and the caption clock to the start — and, worse, write a
              // zero into the watch-progress reporter for the film being
              // watched. The gate closes at the switch and reopens in `onLoad`,
              // the moment the seek is issued.
              if (pendingResumeRef.current !== null) return;
              setBuffered(bufferedSeconds);
              setPosition(currentTime);
              updatePosition(currentTime);
            }}
            onLoad={({ durationSeconds }) => {
              setDuration(durationSeconds);
              // This source opened, so any later failure of it is an expiry and
              // not a rung missing from storage — see `dropToAutoAfterError`.
              sourceEverLoadedRef.current = true;
              const resumeAt = pendingResumeRef.current;
              if (resumeAt === null) return;
              // Cleared BEFORE the seek: from here VideoPlayer's own
              // pendingSeekRef holds the ticks until the reported time is
              // actually near the target, so the resume needs no settling
              // machinery of its own. Clearing first also makes a second,
              // spurious `sourceLoad` mid-playback a no-op, and it retires the
              // give-up backstop the switch armed.
              clearResumeWait();
              // Issued here rather than from the switch, because a seek into a
              // player that has not parsed its manifest yet is unreliable —
              // this is the first moment the new source has a duration.
              videoRef.current?.seek(resumeAt);
            }}
            onBufferingChange={setIsBuffering}
            onEnd={reportNow}
            onError={(message) => {
              // Recorded BEFORE either cure runs, so neither can hand this very
              // link back as the recovery — that is what bounds the two of them
              // when nothing plays at all. See `failedSourcesRef`.
              failedSourcesRef.current.add(sourceUrl);
              // The ladder gets the first word, but only for a source that
              // never opened: a rung that was never uploaded must not cost the
              // stream its one fresh-link attempt, and an expiry mid-film must
              // not be mistaken for one.
              if (dropToAutoAfterError()) return;
              recoverPlayback(() => setPlaybackError(message ?? t.movie.playbackError));
            }}
          />
        )}

        {/* Directly above the picture and below every other layer, so the
            buffering and error scrims dim the caption the way they dim the
            video, and the controls always paint over it. */}
        <SubtitleOverlay
          lines={subtitleLines}
          size={subtitleSize}
          background={subtitleBackground}
          // The same boolean the control bar's own visibility uses — the
          // caption steps up exactly while the bar is there.
          liftForControls={controlsVisible}
          stageWidth={stageSize.width}
          stageHeight={stageSize.height}
          edgeInsets={captionInsets}
        />

        {showBuffering && (
          <View style={[StyleSheet.absoluteFill, styles.bufferingOverlay]} pointerEvents="none">
            <View style={styles.bufferingPill}>
              <ActivityIndicator color={theme.colors.primary} />
              <ThemedText variant="caption" weight="semibold">
                {t.player.buffering}
              </ThemedText>
            </View>
          </View>
        )}

        {/*
         * Separate siblings (not a parent wrapping VideoPlayer) so the native
         * video surface never sits between this backdrop and PlayerControls'
         * buttons in the touch-dispatch tree — wrapping Video inside a
         * Pressable let taps on the buttons rendered "on top" fall through to
         * this backdrop instead, since the video surface's own touch handling
         * won responder priority over the later PlayerControls sibling.
         * Three zones instead of one so a double tap on the left/right third
         * can seek; the container itself never becomes a responder.
         */}
        <View style={[StyleSheet.absoluteFill, styles.tapZones]} pointerEvents="box-none">
          <Pressable style={styles.tapZone} onPress={() => handleZoneTap("left")} />
          <Pressable style={styles.tapZone} onPress={() => handleZoneTap("center")} />
          <Pressable style={styles.tapZone} onPress={() => handleZoneTap("right")} />
        </View>

        {seekFlash && (
          <View style={[StyleSheet.absoluteFill, styles.seekFlashLayer]} pointerEvents="none">
            <View style={[styles.seekFlash, seekFlash === "left" ? styles.seekFlashLeft : styles.seekFlashRight]}>
              <Ionicons
                name={seekFlash === "left" ? "play-back" : "play-forward"}
                size={22}
                color={theme.colors.primary}
              />
              <ThemedText variant="caption" weight="bold" tabular>
                {seekFlash === "left" ? `-${SKIP_SECONDS}s` : `+${SKIP_SECONDS}s`}
              </ThemedText>
            </View>
          </View>
        )}

        {playbackError && (
          <View style={[StyleSheet.absoluteFill, styles.errorOverlay]} pointerEvents="none">
            <View style={styles.messageTile}>
              <Ionicons name="warning-outline" size={26} color={theme.colors.danger} />
            </View>
            <ThemedText variant="body" style={styles.centerText}>
              {playbackError}
            </ThemedText>
          </View>
        )}

        <PlayerControls
          visible={controlsVisible}
          title={movie?.title ?? ""}
          subtitle={episodeLabel}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onSkip={handleSkip}
          positionSeconds={position}
          durationSeconds={duration}
          bufferedSeconds={buffered}
          onSeek={handleSeek}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenSpeed={() => setSpeedSheetOpen(true)}
          onBack={handleBack}
          speed={preferredSpeed}
          isBuffering={showBuffering}
          onOpenEpisodes={seriesId ? () => setEpisodeSheetOpen(true) : undefined}
          // Undefined hides the control outright: a title with no subtitles at
          // all gets no button, rather than a menu whose only row is "Off".
          onOpenSubtitles={streamSubtitles.length > 0 ? () => setSubtitleSheetOpen(true) : undefined}
          subtitleTag={activeSubtitle ? subtitleTrackTag(activeSubtitle) : undefined}
          // Same rule as the subtitle control: a title with no ladder to choose
          // from gets no button at all rather than a sheet whose only row is
          // "Auto".
          onOpenQuality={qualities.length > 0 ? () => setQualitySheetOpen(true) : undefined}
          // The label verbatim, and nothing on Auto — so the badge means "you
          // have left the adaptive default", exactly as the speed control stays
          // bare at 1x. `activeQuality` rather than the stored label, because a
          // title lacking that rung really is playing Auto.
          qualityTag={activeQuality?.label}
        />
      </View>

      {showEpisodesRail && seriesId && (
        <EpisodesSection seriesId={seriesId} currentEpisodeId={movieId} onSelectEpisode={handleSelectEpisode} />
      )}

      {/* One memoized subtree, so the 4x/s playback tick stops at this line:
          every prop is state, a structurally shared query record, a useMemo
          or a useCallback — nothing here is built per render. */}
      {!isFullscreen && !seriesId && movie && (
        <MoviePortraitDetails
          movie={movie}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onShare={handleShare}
          similarMovies={similarMovies}
          onPlaySimilar={handlePlaySimilar}
          bottomInset={insets.bottom}
        />
      )}

      {/* Mounted only while open — the same treatment EpisodeSheet already
          gets below, for the same reason: this screen renders four times a
          second off the playback tick, and a closed sheet's whole element tree
          was being built on every one of them. None of the three holds any
          internal state (they have no hooks at all), and BottomSheet's own
          position is derived from the window, not measured — so a fresh mount
          opens exactly as the kept-mounted one did. */}
      {speedSheetOpen && (
        <SpeedSheet
          visible
          value={preferredSpeed}
          onSelect={handleSelectSpeed}
          onClose={() => setSpeedSheetOpen(false)}
        />
      )}

      {qualitySheetOpen && (
        <QualitySheet
          visible
          options={qualities}
          // What is PLAYING, not what is merely remembered — see `activeQuality`.
          value={activeQuality?.label ?? null}
          onSelect={handleSelectQuality}
          onClose={() => setQualitySheetOpen(false)}
        />
      )}

      {subtitleSheetOpen && (
        <SubtitleSheet
          visible
          tracks={streamSubtitles}
          value={activeSubtitle}
          onSelect={handleSelectSubtitle}
          onClose={() => setSubtitleSheetOpen(false)}
        />
      )}

      {seriesId && (
        <EpisodeSheet
          visible={episodeSheetOpen}
          onClose={() => setEpisodeSheetOpen(false)}
          seriesId={seriesId}
          currentEpisodeId={movieId}
          onSelectEpisode={handleSelectEpisode}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  gate: { flex: 1, backgroundColor: theme.colors.background },
  stage: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  stageFull: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  centerText: { textAlign: "center" },
  messageTile: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  errorOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.scrim,
  },
  bufferingOverlay: { alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.scrimSoft },
  bufferingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.scrim,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  tapZones: { flexDirection: "row" },
  tapZone: { flex: 1 },
  seekFlashLayer: { flexDirection: "row", alignItems: "center" },
  seekFlash: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.scrim,
    borderWidth: 1,
    borderColor: theme.colors.primary + "3D",
  },
  seekFlashLeft: { marginLeft: theme.spacing.xl },
  seekFlashRight: { marginLeft: "auto", marginRight: theme.spacing.xl },
});

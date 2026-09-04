import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar, Pressable, ScrollView, View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useKeepAwake } from "expo-keep-awake";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SubtitleTrack } from "expo-video";
import { VideoPlayer, type VideoPlayerHandle } from "@/video/VideoPlayer";
import { PlayerControls } from "@/components/player/PlayerControls";
import { SpeedMenu } from "@/components/player/SpeedMenu";
import { SubtitleMenu } from "@/components/player/SubtitleMenu";
import { EpisodeSheet } from "@/components/player/EpisodeSheet";
import { LockedOverlay } from "@/components/player/LockedOverlay";
import { EpisodesSection } from "@/components/player/EpisodesSection";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { TopBar } from "@/components/layout/TopBar";
import { Synopsis } from "@/components/detail/Synopsis";
import { useStreamInfo } from "@/hooks/useVideo";
import { useMovie } from "@/hooks/useMovies";
import { useWatchProgressReporter } from "@/video/useWatchProgressReporter";
import { useLanguage } from "@/localization/LanguageProvider";
import { usePlayerPrefsStore } from "@/store/playerPrefsStore";
import {
  findSubtitleTrackByLanguage,
  isSameSubtitleTrackList,
  subtitleTrackKey,
  subtitleTrackTag,
} from "@/video/subtitleTracks";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

const CONTROLS_HIDE_DELAY_MS = 3000;
/** Two taps on the same side within this window count as a double-tap seek. */
const DOUBLE_TAP_MS = 280;
const SEEK_FLASH_MS = 600;
const SKIP_SECONDS = 10;

type TapZone = "left" | "center" | "right";

export function PlayerScreen({ route, navigation }: Props) {
  const { movieId } = route.params;
  const { t } = useLanguage();
  useKeepAwake();

  const movieQuery = useMovie(movieId);
  const streamQuery = useStreamInfo(movieId);
  const preferredSpeed = usePlayerPrefsStore((s) => s.preferredSpeed);
  const setPreferredSpeed = usePlayerPrefsStore((s) => s.setPreferredSpeed);
  const preferredSubtitleLanguage = usePlayerPrefsStore((s) => s.preferredSubtitleLanguage);
  const setPreferredSubtitleLanguage = usePlayerPrefsStore((s) => s.setPreferredSubtitleLanguage);
  const insets = useSafeAreaInsets();

  const videoRef = useRef<VideoPlayerHandle>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [episodeSheetOpen, setEpisodeSheetOpen] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [seekFlash, setSeekFlash] = useState<TapZone | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
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
    };
  }, []);

  // Always restore portrait + orientation auto-unlock on leaving the player,
  // regardless of whether the user toggled fullscreen.
  useEffect(() => {
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      setIsFullscreen(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      setIsFullscreen(true);
    }
    scheduleHide();
  };

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
    const target = Math.max(0, Math.min(duration, position + delta));
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
   * Which rendition is showing is DERIVED, never a second piece of state: a
   * language is the single source of truth, resolved against whatever this
   * particular title declares in its manifest. So there is nothing to keep in
   * sync when the track list arrives late, and a title without that language
   * just plays without subtitles instead of silently clearing the preference.
   *
   * Which language depends on whether the viewer has ever chosen. `undefined`
   * means they have not, and then the manifest's own DEFAULT=YES track wins —
   * matching the web client, where hls.js auto-selects it. Only an explicit
   * `null` ("Off") suppresses it, because VideoPlayer asserts this choice and
   * asserting null actively disables the text renderer. Conflating the two is
   * what made a fresh install turn the default track off.
   */
  const defaultSubtitleLanguage =
    streamQuery.data?.status === "ready" ? streamQuery.data.defaultSubtitleLanguage : null;
  const subtitleLanguage =
    preferredSubtitleLanguage === undefined ? defaultSubtitleLanguage : preferredSubtitleLanguage;

  const activeSubtitleTrack = useMemo(
    () => findSubtitleTrackByLanguage(subtitleTracks, subtitleLanguage),
    [subtitleTracks, subtitleLanguage],
  );

  /**
   * The renditions are reported more than once — `sourceLoad` fires before the
   * player has finished parsing the master playlist, then
   * `availableSubtitleTracksChange` fires (possibly repeatedly) as they appear
   * — and every report allocates new objects. Dropping the equal ones stops a
   * pointless re-render of the whole player on top of the 500ms progress tick.
   */
  const handleSubtitleTracksChange = useCallback((tracks: SubtitleTrack[]) => {
    setSubtitleTracks((current) => (isSameSubtitleTrackList(current, tracks) ? current : tracks));
  }, []);

  const handleSelectSubtitle = (track: SubtitleTrack | null) => {
    setPreferredSubtitleLanguage(track ? subtitleTrackKey(track) : null);
  };

  const handleSubscribe = () =>
    navigation.navigate("Main", { screen: "HomeTab", params: { screen: "Subscribe" } });

  const handleSelectEpisode = (episodeId: string) => {
    reportNow();
    navigation.replace("Player", { movieId: episodeId });
  };

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

  if (movieQuery.isLoading || streamQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (streamQuery.data?.status === "forbidden") {
    return (
      <View style={styles.gate}>
        <StatusBar hidden={false} />
        <LockedOverlay onSubscribe={handleSubscribe} />
        <TopBar transparent onBack={() => navigation.goBack()} />
      </View>
    );
  }

  if (!streamQuery.data || streamQuery.data.status !== "ready") {
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
  const seriesId = movie?.seriesId;
  // null when the runtime was never measured — the Pill is dropped rather than reading "0m".
  const runtime = formatDuration(movie?.duration);
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

      <View style={isFullscreen ? styles.stageFull : styles.stage}>
        <VideoPlayer
          ref={videoRef}
          playlistUrl={streamQuery.data.playlistUrl}
          paused={!isPlaying}
          rate={preferredSpeed}
          volume={1}
          muted={muted}
          subtitleTrack={activeSubtitleTrack}
          subtitleTracksReady={subtitleTracks.length > 0}
          onSubtitleTracksChange={handleSubtitleTracksChange}
          onProgress={({ currentTime, bufferedSeconds }) => {
            setBuffered(bufferedSeconds);
            setPosition(currentTime);
            updatePosition(currentTime);
          }}
          onLoad={({ durationSeconds }) => setDuration(durationSeconds)}
          onBufferingChange={setIsBuffering}
          onEnd={reportNow}
          onError={(message) => setPlaybackError(message ?? t.movie.playbackError)}
        />

        {isBuffering && !playbackError && (
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
          onOpenSpeedMenu={() => setSpeedMenuOpen(true)}
          onBack={handleBack}
          speed={preferredSpeed}
          isBuffering={isBuffering}
          onOpenEpisodes={seriesId ? () => setEpisodeSheetOpen(true) : undefined}
          // Undefined hides the control outright: a title whose manifest
          // declares no subtitle rendition gets no button, rather than a menu
          // whose only row is "Off".
          onOpenSubtitles={subtitleTracks.length > 0 ? () => setSubtitleMenuOpen(true) : undefined}
          subtitleTag={activeSubtitleTrack ? subtitleTrackTag(activeSubtitleTrack) : undefined}
        />
      </View>

      {showEpisodesRail && seriesId && (
        <EpisodesSection seriesId={seriesId} currentEpisodeId={movieId} onSelectEpisode={handleSelectEpisode} />
      )}

      {!isFullscreen && !seriesId && movie && (
        <ScrollView
          style={styles.details}
          contentContainerStyle={[styles.detailsContent, { paddingBottom: insets.bottom + theme.spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText variant="title" numberOfLines={2}>
            {movie.title}
          </ThemedText>

          <View style={styles.detailsMeta}>
            {movie.rating > 0 && (
              <Pill tone="premium">
                {"★ "}
                {movie.rating.toFixed(1)}
              </Pill>
            )}
            <Pill tone="neutral">{String(movie.releaseYear)}</Pill>
            {runtime && <Pill tone="neutral">{runtime}</Pill>}
            <Pill tone="neutral">{movie.genre}</Pill>
          </View>

          <Synopsis text={movie.description} title={t.movie.synopsis} />
        </ScrollView>
      )}

      <SpeedMenu
        visible={speedMenuOpen}
        value={preferredSpeed}
        onSelect={handleSelectSpeed}
        onClose={() => setSpeedMenuOpen(false)}
      />

      <SubtitleMenu
        visible={subtitleMenuOpen}
        tracks={subtitleTracks}
        value={activeSubtitleTrack}
        onSelect={handleSelectSubtitle}
        onClose={() => setSubtitleMenuOpen(false)}
      />

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
  details: { flex: 1 },
  detailsContent: {
    padding: theme.layout.screenPadding,
    gap: theme.spacing.md,
  },
  detailsMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.sm },
});

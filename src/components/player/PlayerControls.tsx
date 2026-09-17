import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { ProgressBar } from "@/components/player/ProgressBar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { formatTime } from "@/utils/format";

interface Props {
  visible: boolean;
  title: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkip: (deltaSeconds: number) => void;
  positionSeconds: number;
  durationSeconds: number;
  bufferedSeconds: number;
  onSeek: (seconds: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSpeed: () => void;
  onBack: () => void;
  /** Quiet second line under the title — e.g. "S1 · E4". */
  subtitle?: string;
  /** Current playback rate, shown on the speed control. */
  speed?: number;
  /** Opens the episode picker sheet. Omit for non-series titles. */
  onOpenEpisodes?: () => void;
  /** Opens the subtitle picker. Omit when the title declares no subtitle renditions. */
  onOpenSubtitles?: () => void;
  /** Short language badge shown on the subtitle control while a track is on. */
  subtitleTag?: string;
  /** Opens the quality picker. Omit when the title offers no rendition ladder. */
  onOpenQuality?: () => void;
  /**
   * The pinned rendition's label — "720p". Absent on Auto, so the badge only
   * appears once the viewer has left the adaptive default, exactly as the
   * speed control stays bare at 1x.
   */
  qualityTag?: string;
  /** Swaps the play glyph for a spinner while the stream rebuffers. */
  isBuffering?: boolean;
}

/**
 * The touch control surface over the video. Every control is a 44pt+ target,
 * the scrub bar owns a generous drag area, and the play button is the one
 * violet element so the eye lands on it instantly.
 */
export function PlayerControls({
  visible,
  title,
  isPlaying,
  onTogglePlay,
  onSkip,
  positionSeconds,
  durationSeconds,
  bufferedSeconds,
  onSeek,
  muted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onOpenSpeed,
  onBack,
  subtitle,
  speed,
  onOpenEpisodes,
  onOpenSubtitles,
  subtitleTag,
  onOpenQuality,
  qualityTag,
  isBuffering,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // In fullscreen the video is edge-to-edge, so the controls carry the safe
  // area themselves: landscape puts the cutout on one side and the home
  // indicator along the bottom. Inline, the stage is already below them.
  const topBarInset = isFullscreen
    ? {
        paddingTop: insets.top + theme.spacing.sm,
        paddingLeft: insets.left + theme.spacing.sm,
        paddingRight: insets.right + theme.spacing.sm,
      }
    : null;
  const bottomBarInset = isFullscreen
    ? {
        paddingBottom: insets.bottom + theme.spacing.sm,
        paddingLeft: insets.left + theme.spacing.md,
        paddingRight: insets.right + theme.spacing.md,
      }
    : null;

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
      <LinearGradient
        colors={[theme.colors.scrim, "transparent"]}
        style={[styles.topBar, topBarInset]}
        pointerEvents="box-none"
      >
        <ControlButton icon="chevron-back" label={t.common.back} onPress={onBack} />
        <View style={styles.titleBlock} pointerEvents="none">
          <ThemedText variant="section" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" numberOfLines={1} tabular>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </LinearGradient>

      <LinearGradient
        colors={["transparent", theme.colors.scrim]}
        style={[styles.bottomBar, bottomBarInset]}
        pointerEvents="box-none"
      >
        <ProgressBar
          durationSeconds={durationSeconds}
          positionSeconds={positionSeconds}
          bufferedSeconds={bufferedSeconds}
          onSeek={onSeek}
        />

        <View style={styles.bottomRow}>
          <View style={styles.timeBlock} pointerEvents="none">
            <ThemedText variant="caption" weight="semibold" tabular numberOfLines={1} style={styles.timeCurrent}>
              {formatTime(positionSeconds)}
            </ThemedText>
            <ThemedText variant="caption" tabular numberOfLines={1}>
              {" / "}
              {formatTime(durationSeconds)}
            </ThemedText>
          </View>

          <View style={styles.bottomActions}>
            <ControlButton
              icon={muted ? "volume-mute" : "volume-high"}
              label={muted ? t.player.unmute : t.player.mute}
              onPress={onToggleMute}
            />
            <ControlButton icon="speedometer-outline" label={t.movie.speed} onPress={onOpenSpeed}>
              {typeof speed === "number" && speed !== 1 ? <Tag text={`${speed}x`} /> : null}
            </ControlButton>
            {onOpenQuality && (
              <ControlButton
                icon="options-outline"
                label={t.player.quality}
                onPress={onOpenQuality}
                active={!!qualityTag}
              >
                {qualityTag ? <Tag text={qualityTag} /> : null}
              </ControlButton>
            )}
            {onOpenSubtitles && (
              <ControlButton
                icon="logo-closed-captioning"
                label={t.player.subtitles}
                onPress={onOpenSubtitles}
                active={!!subtitleTag}
              >
                {subtitleTag ? <Tag text={subtitleTag} /> : null}
              </ControlButton>
            )}
            {onOpenEpisodes && (
              <ControlButton icon="list" label={t.series.episodesTitle} onPress={onOpenEpisodes} />
            )}
            <ControlButton
              icon={isFullscreen ? "contract" : "expand"}
              label={isFullscreen ? t.player.exitFullscreen : t.player.enterFullscreen}
              onPress={onToggleFullscreen}
            />
          </View>
        </View>
      </LinearGradient>

      {/*
       * LAST on purpose, so these sit on top for TOUCH. Inline (portrait) the
       * stage is only 16:9 of the screen width — about 221dp — while the two
       * bars and this row want ~288dp between them, so they necessarily
       * overlap. The scrub bar carries 16dp of invisible slack above its
       * 5dp track, and while it rendered after this row that slack covered the
       * bottom 25dp of the play button: taps there scrubbed the film instead of
       * pausing it, and the biggest control on screen felt broken. A touch that
       * lands on a VISIBLE control belongs to that control, so the visible disc
       * wins over invisible slack drawn beneath it. Nothing moves visually —
       * this row has no background of its own.
       */}
      <View style={styles.centerControls} pointerEvents="box-none">
        <ControlButton icon="play-back" label={t.player.skipBack} onPress={() => onSkip(-10)} size="lg" />
        <Pressable
          onPress={onTogglePlay}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t.player.pause : t.player.play}
        >
          {isBuffering ? (
            <ActivityIndicator color={theme.colors.onPrimary} size="large" />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={34}
              color={theme.colors.onPrimary}
              style={isPlaying ? undefined : styles.playGlyph}
            />
          )}
        </Pressable>
        <ControlButton icon="play-forward" label={t.player.skipForward} onPress={() => onSkip(10)} size="lg" />
      </View>
    </View>
  );
}

interface ControlButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: "md" | "lg";
  /** Tints the glyph violet — the control is currently doing something. */
  active?: boolean;
  /** Decoration rendered inside the button (e.g. the speed / subtitle tag). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Round glassy control — 44pt at "md", 56pt at "lg". */
function ControlButton({ icon, label, onPress, size = "md", active, children, style }: ControlButtonProps) {
  const dims = size === "lg" ? styles.controlLg : styles.controlMd;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.control, dims, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={size === "lg" ? 24 : 20}
        color={active ? theme.colors.primary : theme.colors.text}
      />
      {children}
    </Pressable>
  );
}

/** The little violet pill a control wears to show its non-default state. */
function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag} pointerEvents="none">
      <ThemedText variant="caption" weight="bold" tabular style={styles.tagText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The three rows are ANCHORED to the stage's edges, not stacked in flow.
  // Inline (portrait) the stage is only 16:9 of the screen width — about 219pt
  // on a 390pt-wide phone — while the rows' natural heights add up to ~260pt
  // (84 top + 72 play button + 104 bottom). Laid out in flow with
  // `space-between`, that overflow pushed the bottom row — mute, speed,
  // subtitles, fullscreen — clean out of the bottom of the video. Anchoring
  // keeps every control over the picture at any stage height; overlapping is
  // the normal trade for a player overlay, and the gradients keep them legible.
  container: {},
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  titleBlock: { flex: 1, gap: 1, paddingRight: theme.spacing.sm },
  centerControls: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xl,
  },
  control: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.overlay,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  controlMd: { width: theme.layout.minTouch, height: theme.layout.minTouch },
  controlLg: { width: 56, height: 56 },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    ...theme.shadow.lg,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
  },
  playGlyph: { marginLeft: 4 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  // The action buttons are fixed 44pt targets, so on a narrow phone a full set
  // of them (mute · speed · subtitles · episodes · fullscreen) plus a
  // "0:00 / 1:23:45" readout can exceed the row. The clock is the part that may
  // give way — shrinking here, never there, keeps every control on screen.
  timeBlock: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  timeCurrent: { color: theme.colors.text },
  bottomActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, flexShrink: 0 },
  tag: {
    position: "absolute",
    bottom: -2,
    paddingHorizontal: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  tagText: { color: theme.colors.onPrimary, fontSize: 10, lineHeight: 14 },
});

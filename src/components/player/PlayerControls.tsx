import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { ProgressBar } from "@/components/player/ProgressBar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

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
  onOpenSpeedMenu: () => void;
  onBack: () => void;
  /** Quiet second line under the title — e.g. "S1 · E4". */
  subtitle?: string;
  /** Current playback rate, shown on the speed control. */
  speed?: number;
  /** Opens the episode picker sheet. Omit for non-series titles. */
  onOpenEpisodes?: () => void;
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
  onOpenSpeedMenu,
  onBack,
  subtitle,
  speed,
  onOpenEpisodes,
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
            <ThemedText variant="caption" weight="semibold" tabular style={styles.timeCurrent}>
              {formatTime(positionSeconds)}
            </ThemedText>
            <ThemedText variant="caption" tabular>
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
            <ControlButton icon="speedometer-outline" label={t.movie.speed} onPress={onOpenSpeedMenu}>
              {typeof speed === "number" && speed !== 1 ? (
                <View style={styles.speedTag} pointerEvents="none">
                  <ThemedText variant="caption" weight="bold" tabular style={styles.speedTagText}>
                    {speed}x
                  </ThemedText>
                </View>
              ) : null}
            </ControlButton>
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
    </View>
  );
}

interface ControlButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: "md" | "lg";
  /** Decoration rendered inside the button (e.g. the speed tag). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Round glassy control — 44pt at "md", 56pt at "lg". */
function ControlButton({ icon, label, onPress, size = "md", children, style }: ControlButtonProps) {
  const dims = size === "lg" ? styles.controlLg : styles.controlMd;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.control, dims, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size === "lg" ? 24 : 20} color={theme.colors.text} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  titleBlock: { flex: 1, gap: 1, paddingRight: theme.spacing.sm },
  centerControls: {
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
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  timeBlock: { flexDirection: "row", alignItems: "center" },
  timeCurrent: { color: theme.colors.text },
  bottomActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  speedTag: {
    position: "absolute",
    bottom: -2,
    paddingHorizontal: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  speedTagText: { color: theme.colors.onPrimary, fontSize: 10, lineHeight: 14 },
});

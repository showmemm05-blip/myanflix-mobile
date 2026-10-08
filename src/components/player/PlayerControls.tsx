import { useState, type ReactNode } from "react";
import { Pressable, View, StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { ProgressBar } from "@/components/player/ProgressBar";
import { BufferingDots } from "@/components/player/BufferingDots";
import { PlayerGlyph, SkipGlyph, type PlayerGlyphName } from "@/components/player/PlayerGlyph";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { formatTime } from "@/utils/format";

/** What one tap of a skip control (or a double tap on the stage) moves. */
const SKIP_SECONDS = 10;
/**
 * The chrome is dense, fixed-size video furniture: past this multiple of the
 * user's text size the clocks and button labels would push the controls off
 * the picture. They still grow — up to 1.6× — and labels wrap rather than
 * truncate (the landscape action row wraps onto a second line).
 */
const CHROME_FONT_CAP = 1.6;

/** The boards' scrims (Player / PlayerLandscape .dc.html), in the page ground's hue. */
const SCRIM_TOP = ["rgba(8,8,11,0.72)", "rgba(8,8,11,0)"] as const;
const SCRIM_TOP_FULL = ["rgba(8,8,11,0.78)", "rgba(8,8,11,0)"] as const;
const SCRIM_BOTTOM = ["rgba(8,8,11,0)", "rgba(8,8,11,0.82)"] as const;
const SCRIM_BOTTOM_FULL = ["rgba(8,8,11,0)", "rgba(8,8,11,0.88)"] as const;

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
  /** Opens the settings panel on its speed tab (portrait: the one settings control). */
  onOpenSpeed: () => void;
  onBack: () => void;
  /** Quiet second line under the fullscreen title — e.g. "S1 · E4". */
  subtitle?: string;
  /** Current playback rate; shown as a tag once it leaves 1x. */
  speed?: number;
  /** Opens the episode picker. Omit for non-series titles. */
  onOpenEpisodes?: () => void;
  /** Opens the settings panel on its subtitles tab. Omit when the title declares no subtitles. */
  onOpenSubtitles?: () => void;
  /** Short language badge shown on the subtitle control while a track is on. */
  subtitleTag?: string;
  /** Opens the settings panel on its quality tab. Omit when the title offers no rendition ladder. */
  onOpenQuality?: () => void;
  /**
   * The pinned rendition's label — "720p". Absent on Auto, so the badge only
   * appears once the viewer has left the adaptive default, exactly as the
   * speed control stays bare at 1x.
   */
  qualityTag?: string;
  /** Swaps the play glyph for pulsing dots while the stream rebuffers. */
  isBuffering?: boolean;
  /** Plays the next episode in the series order. Omit to hide (films, the last episode). */
  onNextEpisode?: () => void;
  /** Spoken on the Next-episode control — names the episode it plays. */
  nextEpisodeLabel?: string;
  /**
   * Reports how far up from the stage's bottom edge the bottom controls reach,
   * in pt, so the caption can lift clear of them. Measured, not assumed: the
   * landscape action row wraps onto a second line for long labels or large text.
   * `fullscreen` says which layout was measured — the two bars differ, so the
   * caller keeps one value per layout rather than carrying the other's across
   * a toggle.
   */
  onBottomClearance?: (clearance: number, fullscreen: boolean) => void;
}

/** One measurement per layout: the portrait bar and the fullscreen bar are different heights. */
type PerLayout = { inline: number; full: number };

/**
 * Room kept between the fullscreen centre row (skip · play · skip) and the
 * action row under it. Without it, a WRAPPED action row — long Burmese labels
 * on a narrow landscape phone, or large text — rises into the play disc, and
 * because the centre row is on top for touch, the top of the Quality and
 * Subtitles pills stops answering.
 */
const CENTER_GAP = 12;

/**
 * The touch control surface over the video, in the two Marquee layouts:
 *
 * PORTRAIT (Player.dc.html) — back on the left; episodes, subtitles, one
 * settings control (speed + quality, which opens the tabbed panel) and mute
 * on the right; skip · play · skip in the middle; the clock, the seek line and
 * fullscreen along the bottom.
 *
 * FULLSCREEN (PlayerLandscape.dc.html) — back, the title and mute along the
 * top; the seek line with both clocks; then a row of labelled controls:
 * speed, quality, subtitles on the left, episodes, Next episode and exit
 * fullscreen on the right.
 *
 * Every control is a 44pt target. Play is the one white disc, so the eye lands
 * on it instantly. It fades in each time it appears (instantly under reduce
 * motion) and hides at once, as it always has.
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
  onNextEpisode,
  nextEpisodeLabel,
  onBottomClearance,
}: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  /**
   * The measured bottom block (see `onBottomClearance`), per layout — it also
   * sizes the bottom scrim. Kept per layout so the first frame after a toggle
   * (or after the controls come back in the other layout) uses THAT layout's
   * last height, never the other bar's.
   */
  const [bottomClearance, setBottomClearance] = useState<PerLayout>({ inline: 0, full: 0 });
  /** The fullscreen stage's height — where the centre row has to fit between the rows. */
  const [fullStageHeight, setFullStageHeight] = useState(0);

  if (!visible) return null;

  const layoutKey: keyof PerLayout = isFullscreen ? "full" : "inline";
  const clearanceNow = bottomClearance[layoutKey];

  const speedTag = typeof speed === "number" && speed !== 1 ? `${speed}x` : undefined;
  const withState = (label: string, value: string | undefined) =>
    value ? t.player.controlState.replace("{label}", label).replace("{value}", value) : label;

  // Fullscreen is edge-to-edge, so the controls carry the safe area
  // themselves — landscape puts the cutout on one side and the home indicator
  // along the bottom — never closer to the edge than the board's margins.
  const sideTop = isFullscreen ? Math.max(36, insets.left, insets.right) : 4;
  const sideBottom = isFullscreen ? Math.max(38, insets.left, insets.right) : 4;
  const bottomOffset = isFullscreen ? 12 + insets.bottom : 4;

  // `isFullscreen` is captured per render, and each layout has its own bottom
  // block element, so a measurement is always filed under the layout it came from.
  const handleBottomLayout = (e: LayoutChangeEvent) => {
    const clearance = Math.round(e.nativeEvent.layout.height + bottomOffset);
    setBottomClearance((current) =>
      current[layoutKey] === clearance ? current : { ...current, [layoutKey]: clearance },
    );
    onBottomClearance?.(clearance, isFullscreen);
  };

  const handleFrameLayout = (e: LayoutChangeEvent) => {
    if (!isFullscreen) return;
    const height = Math.round(e.nativeEvent.layout.height);
    setFullStageHeight((current) => (current === height ? current : height));
  };

  const playSize = isFullscreen ? 76 : 60;
  const skipSize = isFullscreen ? 56 : 52;

  /**
   * Fullscreen only: the centre row stays in the middle of the picture, as on
   * the board, until the measured action row would reach it — then it rises
   * just enough to keep CENTER_GAP clear of that row, so every labelled pill
   * stays tappable along its full height. It never rises past the top row's
   * top edge: if a very cramped frame (a ~320pt-tall phone with three wrapped
   * lines) cannot fit both, the disc may cover the title, which takes no
   * touches (back and mute sit out at the sides, clear of this row). Portrait
   * keeps its fixed rows — they were laid out to fit a 320pt-wide 16:9 stage.
   */
  let centerShift = 0;
  if (isFullscreen && fullStageHeight > 0 && clearanceNow > 0) {
    const middle = fullStageHeight / 2;
    const lowest = fullStageHeight - clearanceNow - CENTER_GAP - playSize / 2;
    if (lowest < middle) {
      const highest = 14 + insets.top + playSize / 2;
      centerShift = Math.min(0, Math.round(Math.max(lowest, highest) - middle));
    }
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      style={StyleSheet.absoluteFill}
      onLayout={handleFrameLayout}
      pointerEvents="box-none"
    >
      {/* Scrims: a top fade, an even 20% dim, a bottom fade — the boards' recipe. */}
      <LinearGradient
        colors={isFullscreen ? SCRIM_TOP_FULL : SCRIM_TOP}
        style={[styles.scrimTop, { height: isFullscreen ? 120 + insets.top : 76 }]}
        pointerEvents="none"
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
      <LinearGradient
        colors={isFullscreen ? SCRIM_BOTTOM_FULL : SCRIM_BOTTOM}
        style={[
          styles.scrimBottom,
          { height: Math.max(isFullscreen ? 170 : 92, clearanceNow + (isFullscreen ? 76 : 44)) },
        ]}
        pointerEvents="none"
      />

      {isFullscreen ? (
        <View
          style={[styles.topRow, { top: 14 + insets.top, left: sideTop, right: sideTop }]}
          pointerEvents="box-none"
        >
          <ChromeButton glyph="back" glyphSize={24} label={t.common.back} onPress={onBack} />
          <View style={styles.titleBlock} pointerEvents="none">
            <ThemedText weight="extrabold" numberOfLines={2} maxFontSizeMultiplier={CHROME_FONT_CAP} style={styles.fullTitle}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText
                variant="caption"
                weight="semibold"
                tabular
                maxFontSizeMultiplier={CHROME_FONT_CAP}
                color={theme.colors.textBody}
              >
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <ChromeButton
            glyph={muted ? "muted" : "volume"}
            label={muted ? t.player.unmute : t.player.mute}
            onPress={onToggleMute}
          />
        </View>
      ) : (
        <View style={[styles.topRow, styles.topRowInline]} pointerEvents="box-none">
          <ChromeButton glyph="back" glyphSize={24} label={t.common.back} onPress={onBack} />
          <View style={styles.cluster}>
            {onOpenEpisodes && (
              <ChromeButton glyph="episodes" label={t.series.episodesTitle} onPress={onOpenEpisodes} />
            )}
            {onOpenSubtitles && (
              <ChromeButton
                glyph="subtitles"
                label={t.player.subtitles}
                accessibilityLabel={withState(t.player.subtitles, subtitleTag)}
                onPress={onOpenSubtitles}
                tag={subtitleTag}
              />
            )}
            {/* ONE control for speed and quality in portrait: it opens the
                tabbed panel on its speed tab, and the quality tab sits beside
                it whenever the title has a ladder. Its badge says what has
                left the default — the pinned rung first, else the rate. */}
            <ChromeButton
              glyph="settings"
              label={onOpenQuality ? t.player.speedAndQuality : t.movie.speed}
              accessibilityLabel={withState(
                onOpenQuality ? t.player.speedAndQuality : t.movie.speed,
                [speedTag, qualityTag].filter(Boolean).join(" · ") || undefined,
              )}
              onPress={onOpenSpeed}
              tag={qualityTag ?? speedTag}
            />
            <ChromeButton
              glyph={muted ? "muted" : "volume"}
              label={muted ? t.player.unmute : t.player.mute}
              onPress={onToggleMute}
            />
          </View>
        </View>
      )}

      {isFullscreen ? (
        <View
          style={[styles.bottomBlock, { left: sideBottom, right: sideBottom, bottom: bottomOffset }]}
          onLayout={handleBottomLayout}
          pointerEvents="box-none"
        >
          <View style={styles.seekRowFull}>
            <Clock seconds={positionSeconds} strong large />
            <View style={styles.seekLine}>
              <ProgressBar
                durationSeconds={durationSeconds}
                positionSeconds={positionSeconds}
                bufferedSeconds={bufferedSeconds}
                onSeek={onSeek}
              />
            </View>
            <Clock seconds={durationSeconds} large />
          </View>

          <View style={styles.actionRow} pointerEvents="box-none">
            <View style={styles.actionGroup}>
              <ChromeButton
                glyph="speed"
                glyphSize={20}
                label={t.movie.speed}
                accessibilityLabel={withState(t.movie.speed, speedTag)}
                onPress={onOpenSpeed}
                showLabel
                tag={speedTag}
              />
              {onOpenQuality && (
                <ChromeButton
                  glyph="settings"
                  glyphSize={20}
                  label={t.player.quality}
                  accessibilityLabel={withState(t.player.quality, qualityTag)}
                  onPress={onOpenQuality}
                  showLabel
                  tag={qualityTag}
                />
              )}
              {onOpenSubtitles && (
                <ChromeButton
                  glyph="subtitles"
                  glyphSize={20}
                  label={t.player.subtitles}
                  accessibilityLabel={withState(t.player.subtitles, subtitleTag)}
                  onPress={onOpenSubtitles}
                  showLabel
                  tag={subtitleTag}
                />
              )}
            </View>
            <View style={[styles.actionGroup, styles.actionGroupEnd]}>
              {onOpenEpisodes && (
                <ChromeButton
                  glyph="episodes"
                  glyphSize={20}
                  label={t.series.episodesTitle}
                  onPress={onOpenEpisodes}
                  showLabel
                />
              )}
              {onNextEpisode && (
                <ChromeButton
                  glyph="next"
                  glyphSize={20}
                  label={t.player.nextEpisode}
                  accessibilityLabel={nextEpisodeLabel}
                  onPress={onNextEpisode}
                  showLabel
                />
              )}
              <ChromeButton
                glyph="exitFullscreen"
                glyphSize={20}
                label={t.player.exitFullscreen}
                onPress={onToggleFullscreen}
              />
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[styles.bottomBlock, styles.bottomRowInline]}
          onLayout={handleBottomLayout}
          pointerEvents="box-none"
        >
          <Clock seconds={positionSeconds} strong />
          <View style={styles.seekLine}>
            <ProgressBar
              durationSeconds={durationSeconds}
              positionSeconds={positionSeconds}
              bufferedSeconds={bufferedSeconds}
              onSeek={onSeek}
            />
          </View>
          <Clock seconds={durationSeconds} />
          <ChromeButton
            glyph="enterFullscreen"
            glyphSize={20}
            label={t.player.enterFullscreen}
            onPress={onToggleFullscreen}
          />
        </View>
      )}

      {/*
       * LAST on purpose, so these sit on top for TOUCH. Inline (portrait) the
       * stage is only 16:9 of the screen width, so on a narrow phone the rows
       * above and below can reach toward this one; a touch that lands on a
       * VISIBLE control belongs to that control, so the play disc wins over
       * any invisible slack drawn beneath it. Nothing moves visually — this
       * row has no background of its own. In fullscreen it rises clear of a
       * wrapped action row instead (`centerShift` above), so it never covers
       * a labelled pill there.
       */}
      <View
        style={[
          styles.centerControls,
          { gap: isFullscreen ? 64 : 36 },
          centerShift !== 0 && { transform: [{ translateY: centerShift }] },
        ]}
        pointerEvents="box-none"
      >
        <PressScale
          onPress={() => onSkip(-SKIP_SECONDS)}
          accessibilityLabel={t.player.skipBack}
          style={{ width: skipSize, height: skipSize }}
        >
          <SkipGlyph direction="back" size={isFullscreen ? 40 : 34} seconds={SKIP_SECONDS} />
        </PressScale>
        <PressScale
          onPress={onTogglePlay}
          accessibilityLabel={isPlaying ? t.player.pause : t.player.play}
          busy={isBuffering}
          style={[styles.playButton, { width: playSize, height: playSize, borderRadius: playSize / 2 }]}
        >
          {isBuffering ? (
            <BufferingDots color={theme.colors.onPlay} size={isFullscreen ? 8 : 7} />
          ) : (
            <View style={!isPlaying && { marginLeft: isFullscreen ? 4 : 3 }}>
              <PlayerGlyph
                name={isPlaying ? "pause" : "play"}
                size={isFullscreen ? (isPlaying ? 30 : 32) : isPlaying ? 24 : 26}
                color={theme.colors.onPlay}
              />
            </View>
          )}
        </PressScale>
        <PressScale
          onPress={() => onSkip(SKIP_SECONDS)}
          accessibilityLabel={t.player.skipForward}
          style={{ width: skipSize, height: skipSize }}
        >
          <SkipGlyph direction="forward" size={isFullscreen ? 40 : 34} seconds={SKIP_SECONDS} />
        </PressScale>
      </View>
    </Animated.View>
  );
}

/** "18:40" — the current time strong and white, the total a step quieter. */
function Clock({ seconds, strong, large }: { seconds: number; strong?: boolean; large?: boolean }) {
  return (
    <ThemedText
      tabular
      weight={strong ? "bold" : "semibold"}
      numberOfLines={1}
      maxFontSizeMultiplier={CHROME_FONT_CAP}
      color={strong ? theme.colors.text : theme.colors.textBody}
      style={large ? styles.clockLarge : styles.clock}
    >
      {formatTime(seconds)}
    </ThemedText>
  );
}

interface PressScaleProps {
  onPress: () => void;
  accessibilityLabel: string;
  /** Spoken "busy" — the play disc while the stream rebuffers. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** A centred 44pt+ press target that scales to .96 while held (an opacity dip under reduce motion). */
function PressScale({ onPress, accessibilityLabel, busy, style, children }: PressScaleProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={busy ? { busy: true } : undefined}
      style={({ pressed }) => [
        styles.pressCenter,
        style,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      {children}
    </Pressable>
  );
}

interface ChromeButtonProps {
  glyph: PlayerGlyphName;
  glyphSize?: number;
  /** Shown beside the glyph when `showLabel`, and spoken unless `accessibilityLabel` says more. */
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  /** Fullscreen's labelled pill; otherwise a bare 44pt glyph. */
  showLabel?: boolean;
  /** The crimson state badge — "MY", "720p", "1.5x". */
  tag?: string;
}

/** One control of the chrome: a bare 44pt glyph (portrait), or glyph + label (fullscreen). */
function ChromeButton({ glyph, glyphSize = 22, label, accessibilityLabel, onPress, showLabel, tag }: ChromeButtonProps) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        showLabel ? styles.labelled : styles.bare,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      <PlayerGlyph name={glyph} size={glyphSize} />
      {showLabel && (
        <ThemedText
          variant="caption"
          weight="bold"
          color={theme.colors.text}
          maxFontSizeMultiplier={CHROME_FONT_CAP}
          style={styles.labelText}
        >
          {label}
        </ThemedText>
      )}
      {tag ? (
        <View style={showLabel ? styles.tagInline : styles.tagCorner} pointerEvents="none">
          <ThemedText
            weight="extrabold"
            tabular
            maxFontSizeMultiplier={1.3}
            color={theme.colors.onPrimary}
            style={showLabel ? styles.tagInlineText : styles.tagCornerText}
          >
            {tag}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The rows are ANCHORED to the stage's edges, not stacked in flow: inline
  // (portrait) the stage is only 16:9 of the screen width, and in flow the
  // rows' natural heights would push the bottom row out of the picture.
  scrimTop: { position: "absolute", top: 0, left: 0, right: 0 },
  scrimBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  dim: { backgroundColor: "rgba(8,8,11,0.2)" },
  topRow: { position: "absolute", flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  topRowInline: { top: 4, left: 4, right: 4, justifyContent: "space-between" },
  cluster: { flexDirection: "row", alignItems: "center" },
  titleBlock: { flex: 1, minWidth: 0 },
  // 17pt on the role's own leading (+4 for Burmese, from ThemedText) — a fixed
  // 24 would clip stacked Myanmar marks on a two-line title.
  fullTitle: { fontSize: 17, color: theme.colors.text },
  bottomBlock: { position: "absolute" },
  bottomRowInline: {
    left: 14,
    right: 4,
    bottom: 4,
    minHeight: theme.layout.minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  seekRowFull: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 10 },
  seekLine: { flex: 1, minWidth: 48 },
  clock: { fontSize: 12, lineHeight: 16 },
  clockLarge: { fontSize: 13, lineHeight: 18 },
  // Two groups that each wrap: long labels or large text drop a control onto
  // a second line (the block is bottom-anchored, so it grows upward) instead
  // of truncating a label or pushing a control off the picture.
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.sm,
  },
  actionGroup: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2, flexShrink: 1 },
  actionGroupEnd: { justifyContent: "flex-end", marginLeft: "auto" },
  centerControls: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pressCenter: { alignItems: "center", justifyContent: "center" },
  playButton: {
    backgroundColor: theme.colors.play,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  bare: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  labelled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: 10,
    borderRadius: 22,
  },
  labelText: { flexShrink: 1 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.72 },
  // The portrait badge hangs on the glyph's top-right corner.
  tagCorner: {
    position: "absolute",
    right: 1,
    top: 4,
    minHeight: 14,
    paddingHorizontal: 3,
    borderRadius: 4,
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  tagCornerText: { fontSize: 9, lineHeight: 14 },
  // The fullscreen badge sits after the label.
  tagInline: {
    minHeight: 18,
    paddingHorizontal: 5,
    borderRadius: 4,
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  tagInlineText: { fontSize: 11, lineHeight: 18 },
});

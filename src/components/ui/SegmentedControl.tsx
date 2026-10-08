import { memo, useEffect, useState } from "react";
import { Pressable, ScrollView, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Option {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  /** Force the scrolling layout even when the options would fit. */
  scrollable?: boolean;
  /**
   * Shorter rows, for a control that shares a cramped header with something
   * else rather than owning its own band of the screen.
   *
   * Opt-in, and it stays that way: this component is on nine screens, so a
   * global height change would quietly move the wallet, favourites,
   * transactions, category detail, both reader sheets, the search filters and
   * the subtitle menu. Only the caller that is actually short of room asks.
   *
   * The 44pt touch minimum is not given up — the row shrinks visually and
   * `hitSlop` puts the difference back, which is safe here because segments
   * are laid out side by side and the slop only grows vertically.
   */
  compact?: boolean;
  /**
   * "pill" (default) — Marquee's segmented track: a #1C1C23 track whose
   * selected segment turns WHITE with near-black ink (as WalletHistory and the
   * reader draw it), or white-selected chips when it scrolls.
   * "underline" — text tabs with a 3pt CRIMSON bar under the active one (the
   * series page's seasons, the player's settings tabs).
   */
  appearance?: "pill" | "underline";
  /**
   * Let a label WRAP instead of ellipsizing on one line. The row then grows
   * from its 44pt (or compact) minimum, every segment stretches to the
   * tallest, and the indicator follows. Opt-in like `compact`; a no-op while
   * every label fits, so it only changes a row whose long Burmese label at a
   * large text size would otherwise be cut.
   */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

const TRACK_PADDING = 2;
/** The underline appearance's active bar. */
const UNDERLINE_HEIGHT = 3;
/**
 * Both layouts sit on the same 44pt rung as `Chip` (size="md") — the segment
 * itself is the Pressable, so it, not the track around it, has to clear the
 * touch minimum. With the 2pt track inset the fixed track still measures 48pt.
 */
const SEGMENT_HEIGHT = theme.layout.minTouch;
/**
 * The `compact` row. Six points shorter, which is what the eye reads as "this
 * header stopped hogging the screen"; the lost six come back as `hitSlop`, so
 * the finger target is still 44.
 */
const COMPACT_SEGMENT_HEIGHT = 38;
const COMPACT_HIT_SLOP = { top: 3, bottom: 3, left: 0, right: 0 };
/** Above this many options the equal-width layout gets too cramped to read. */
const MAX_FIXED_SEGMENTS = 4;

/**
 * One selection control with two layouts behind the same props:
 *  - up to 4 options → a true segmented control: equal columns with an
 *    indicator that slides to the active segment (white pill, or a crimson
 *    underline with `appearance="underline"`);
 *  - more (or `scrollable`) → a horizontally scrolling strip, so adding a new
 *    option never shrinks the existing labels.
 * Either way each option is a 44pt-tall target.
 *
 * Memoized: on Search this strip shares a header with the search field, and
 * nothing in it can change while the user types. The memo is the half that
 * turns that caller's stable `options`/`onChange` into an actual bail-out —
 * callers still passing inline props simply get the old behaviour.
 */
export const SegmentedControl = memo(function SegmentedControl({
  options,
  value,
  onChange,
  scrollable,
  compact,
  appearance = "pill",
  wrap,
  style,
}: Props) {
  const underline = appearance === "underline";
  const useFixed = !scrollable && options.length > 0 && options.length <= MAX_FIXED_SEGMENTS;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);
  // The indicator still moves under "reduce motion" — it just arrives instantly.
  const reduceMotion = useReducedMotion();

  const segmentWidth = useFixed && trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  useEffect(() => {
    offset.value = withTiming(activeIndex * segmentWidth, { duration: reduceMotion ? 0 : 220 });
  }, [activeIndex, segmentWidth, offset, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  if (useFixed) {
    return (
      <View
        style={[underline ? styles.underlineTrack : styles.track, wrap && styles.trackStretch, style]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        accessibilityRole="tablist"
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={[underline ? styles.underlineIndicator : styles.indicator, { width: segmentWidth }, indicatorStyle]}
            pointerEvents="none"
          />
        )}
        {options.map((option) => (
          <Segment
            key={option.value}
            option={option}
            active={option.value === value}
            compact={compact}
            underline={underline}
            wrap={wrap}
            onPress={() => onChange(option.value)}
            style={styles.fixedSegment}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={style}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Segment
            key={option.value}
            option={option}
            active={active}
            compact={compact}
            underline={underline}
            wrap={wrap}
            onPress={() => onChange(option.value)}
            style={
              underline
                ? [styles.underlineTab, active && styles.underlineTabActive]
                : [styles.chip, active ? styles.chipActive : styles.chipInactive]
            }
          />
        );
      })}
    </ScrollView>
  );
});

interface SegmentProps {
  option: Option;
  active: boolean;
  compact?: boolean;
  underline?: boolean;
  wrap?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function Segment({ option, active, compact, underline, wrap, onPress, style }: SegmentProps) {
  // Pill: near-black on the white selection, #D9D9E0 at rest (11:1 on the track).
  // Underline: white when active, #8C8C99 at rest.
  const color = underline
    ? active
      ? theme.colors.text
      : theme.colors.textFaint
    : active
      ? theme.colors.onPlay
      : theme.colors.textBody;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segment,
        wrap
          ? compact
            ? styles.segmentWrapCompact
            : styles.segmentWrap
          : compact
            ? styles.segmentCompact
            : styles.segmentFixed,
        style,
      ]}
      hitSlop={compact ? COMPACT_HIT_SLOP : undefined}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={option.label}
    >
      {option.icon && <Ionicons name={option.icon} size={16} color={color} />}
      <ThemedText
        variant={underline ? "body" : "muted"}
        weight={active ? "extrabold" : "semibold"}
        numberOfLines={wrap ? undefined : 1}
        style={[wrap && styles.labelWrap, { color }]}
      >
        {option.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** WalletHistory: a #1C1C23 track, radius 12, 2pt inset — no border. */
  track: {
    flexDirection: "row",
    alignItems: "center",
    padding: TRACK_PADDING,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
  },
  /** The selected segment: white, radius 10. */
  indicator: {
    position: "absolute",
    left: TRACK_PADDING,
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.play,
  },
  /** Underline tabs sit on the page with a hairline under the whole row. */
  underlineTrack: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TRACK_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  underlineIndicator: {
    position: "absolute",
    left: TRACK_PADDING,
    bottom: 0,
    height: UNDERLINE_HEIGHT,
    borderRadius: UNDERLINE_HEIGHT / 2,
    backgroundColor: theme.colors.primary,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  segmentFixed: { height: SEGMENT_HEIGHT },
  segmentCompact: { height: COMPACT_SEGMENT_HEIGHT },
  /** `wrap`: the same rungs as a minimum, so a two-line label grows the row. */
  segmentWrap: { minHeight: SEGMENT_HEIGHT, paddingVertical: theme.spacing.xs },
  segmentWrapCompact: { minHeight: COMPACT_SEGMENT_HEIGHT, paddingVertical: theme.spacing.xs },
  labelWrap: { flexShrink: 1, textAlign: "center" },
  /** `wrap`: every segment as tall as the tallest, so the indicator covers them all. */
  trackStretch: { alignItems: "stretch" },
  fixedSegment: { flex: 1 },
  scrollContent: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: 2 },
  /** The scrolling strip: white-selected chips, each the full 44pt target. */
  chip: {
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
  },
  chipActive: { backgroundColor: theme.colors.play },
  chipInactive: { backgroundColor: theme.colors.surfaceElevated },
  underlineTab: {
    paddingHorizontal: theme.spacing.xs,
    borderBottomWidth: UNDERLINE_HEIGHT,
    borderBottomColor: "transparent",
  },
  underlineTabActive: { borderBottomColor: theme.colors.primary },
});

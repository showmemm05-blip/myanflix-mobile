import { useEffect, useState } from "react";
import { Pressable, ScrollView, View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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
  style?: StyleProp<ViewStyle>;
}

const TRACK_PADDING = 2;
/**
 * Both layouts sit on the same 44pt rung as `Chip` (size="md") — the segment
 * itself is the Pressable, so it, not the track around it, has to clear the
 * touch minimum. With the 2pt track inset the fixed track still measures 48pt.
 */
const SEGMENT_HEIGHT = theme.layout.minTouch;
/** Above this many options the equal-width layout gets too cramped to read. */
const MAX_FIXED_SEGMENTS = 4;

/**
 * One selection control with two layouts behind the same props:
 *  - up to 4 options → a true segmented control: equal columns with a violet
 *    indicator that slides to the active segment;
 *  - more (or `scrollable`) → a horizontally scrolling chip strip, so adding a
 *    new option never shrinks the existing labels.
 * Either way each option is a 44pt-tall target, matching a `Chip` beside it.
 */
export function SegmentedControl({ options, value, onChange, scrollable, style }: Props) {
  const useFixed = !scrollable && options.length > 0 && options.length <= MAX_FIXED_SEGMENTS;
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(0);

  const segmentWidth = useFixed && trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;

  useEffect(() => {
    offset.value = withTiming(activeIndex * segmentWidth, { duration: 220 });
  }, [activeIndex, segmentWidth, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  if (useFixed) {
    return (
      <View style={[styles.track, style]} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        {segmentWidth > 0 && (
          <Animated.View style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} pointerEvents="none" />
        )}
        {options.map((option) => (
          <Segment
            key={option.value}
            option={option}
            active={option.value === value}
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
            onPress={() => onChange(option.value)}
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
          />
        );
      })}
    </ScrollView>
  );
}

interface SegmentProps {
  option: Option;
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function Segment({ option, active, onPress, style }: SegmentProps) {
  const color = active ? theme.colors.onPrimary : theme.colors.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.segment, style]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={option.label}
    >
      {option.icon && <Ionicons name={option.icon} size={16} color={color} />}
      <ThemedText variant="label" weight={active ? "bold" : "semibold"} numberOfLines={1} style={{ color }}>
        {option.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    padding: TRACK_PADDING,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  indicator: {
    position: "absolute",
    left: TRACK_PADDING,
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: SEGMENT_HEIGHT,
    paddingHorizontal: theme.spacing.sm,
  },
  fixedSegment: { flex: 1 },
  scrollContent: { flexDirection: "row", gap: theme.spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipInactive: { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
});

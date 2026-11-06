import { memo, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { BOOK_LOOK, GRID_GAP } from "@/lottery/screens/dreams/dreamBook";
import { LT, LT_RADIUS } from "@/lottery/theme/tokens";
import type { DreamBook } from "@/types/lottery";

/** Skeleton rows while a book loads (the board shows six cards: two rows of three). */
const SKELETON_ROWS = 2;

/** The lt-base `lt-pulse`: soft blocks that breathe for a moment (still under reduced motion). */
function usePulse() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : 0.55);
  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [reduceMotion, pulse]);
  return useAnimatedStyle(() => ({ opacity: pulse.value }));
}

/**
 * The dream book while it loads (board `.lt-drskel`): a grid of card-shaped
 * placeholders — a disc, two short lines, the number strip — pulsing. Hidden
 * from screen readers; the live count says "Loading the dream book…".
 */
export const DreamSkeletonGrid = memo(function DreamSkeletonGrid({
  book,
  disc,
  style,
}: {
  book: DreamBook;
  /** The tint disc's size for this window (dreamBook.cardMetrics). */
  disc: number;
  style?: StyleProp<ViewStyle>;
}) {
  const look = BOOK_LOOK[book];
  const glow = usePulse();
  return (
    <View style={[styles.grid, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: SKELETON_ROWS }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: look.cols }, (_, c) => (
            <View key={c} style={[styles.card, { paddingTop: look.padTop, paddingHorizontal: look.padSide }]}>
              <Animated.View style={[styles.block, { width: disc, height: disc, borderRadius: disc / 2 }, glow]} />
              <Animated.View style={[styles.block, styles.line, styles.line1, glow]} />
              <Animated.View style={[styles.block, styles.line, styles.line2, glow]} />
              <Animated.View
                style={[styles.block, styles.num, { height: look.numH, marginHorizontal: -look.padSide }, glow]}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * A request that failed (lt-base 6.13 `lt-banner`, the board's `res.error`):
 * err tint, the alert glyph, a bold title in err ink, one line, and Try
 * again as a ghost button whose text lines up with the title. Read at once.
 */
export const DreamErrorBanner = memo(function DreamErrorBanner({
  title,
  text,
  retryLabel,
  onRetry,
  style,
}: {
  title: string;
  text: string;
  retryLabel: string;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <LtIcon name="alert" size={20} color={LT.err} />
      <View style={styles.bannerBody}>
        <LtText role="buttonSm" color={LT.err}>
          {title}
        </LtText>
        <LtText role="meta" color={LT.ink2}>
          {text}
        </LtText>
        <LtButton variant="ghost" size="sm" label={retryLabel} onPress={onRetry} style={styles.retry} />
      </View>
    </View>
  );
});

/** A short wait on one thing (the generator's dream, the picker's list): a spinner and the words. */
export const DreamLoadingLine = memo(function DreamLoadingLine({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.loading, style]} accessible accessibilityLabel={text} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={LT.ink2} />
      <LtText role="meta" color={LT.ink2}>
        {text}
      </LtText>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { gap: GRID_GAP },
  row: { flexDirection: "row", gap: GRID_GAP },
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 8,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    overflow: "hidden",
  },
  block: { backgroundColor: LT.mist, borderRadius: LT_RADIUS.input },
  line: { height: 12, borderRadius: 3 },
  line1: { width: "60%" },
  line2: { width: "40%" },
  num: { alignSelf: "stretch", borderRadius: 0, marginTop: -2 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.errTint,
    borderWidth: 1,
    borderColor: LT.errLine,
    borderRadius: LT_RADIUS.button,
  },
  bannerBody: { flex: 1, minWidth: 0 },
  /** The ghost button's text lines up with the title (board: margin 6 0 0 −14). */
  retry: { alignSelf: "flex-start", marginTop: 6, marginLeft: -14 },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
});

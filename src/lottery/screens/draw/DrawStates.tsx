import { memo, useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LtButton } from "@/lottery/components/LtButton";
import { LtEmpty } from "@/lottery/components/LtEmpty";
import { LT_COPY } from "@/lottery/copy";
import { DreamErrorBanner } from "@/lottery/screens/dreams/DreamStates";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/** The soft pulse every Lottery skeleton shares (GenTicketSkeleton's): 0.55 → 1 and back, still under reduced motion. */
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
 * The draw card's place while the current draw loads: the same white card
 * with soft blocks where the kicker, the draw number, the date line, the
 * countdown and the number window will be. Hidden from screen readers; the
 * page's live line says "Loading the draw…".
 */
export const DrawCardSkeleton = memo(function DrawCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const glow = usePulse();
  return (
    <View style={[styles.card, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.block, styles.kicker, glow]} />
      <Animated.View style={[styles.block, styles.display, glow]} />
      <Animated.View style={[styles.block, styles.line, glow]} />
      <Animated.View style={[styles.block, styles.lineShort, glow]} />
      <Animated.View style={[styles.block, styles.countdown, glow]} />
      <Animated.View style={[styles.block, styles.window, glow]} />
    </View>
  );
});

/** A smaller card's place (the dream generator's draw strip, Home's promotion): three lines. */
export const DrawStripSkeleton = memo(function DrawStripSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const glow = usePulse();
  return (
    <View style={[styles.strip, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.block, styles.kicker, glow]} />
      <Animated.View style={[styles.block, styles.line, glow]} />
      <Animated.View style={[styles.block, styles.lineShort, glow]} />
    </View>
  );
});

/** The current draw did not load: the err banner with Try again (the dream pages' own). */
export const DrawErrorBanner = memo(function DrawErrorBanner({
  onRetry,
  style,
}: {
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <DreamErrorBanner
      title={LT_COPY.draw.errorTitle}
      text={LT_COPY.draw.errorText}
      retryLabel={LT_COPY.draw.retry}
      onRetry={onRetry}
      style={style}
    />
  );
});

/** There is no draw at all yet (the admin has not set one up): "No draw yet", with one way on when the page has one. */
export const NoDrawYet = memo(function NoDrawYet({
  action,
  style,
}: {
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LtEmpty
      title={LT_COPY.draw.noneTitle}
      text={LT_COPY.draw.noneText}
      action={action ? <LtButton variant="secondary" label={action.label} iconRight="next" onPress={action.onPress} /> : undefined}
      style={style}
    />
  );
});

const styles = StyleSheet.create({
  card: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s2,
  },
  strip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.card,
    boxShadow: LT_SHADOW.s1,
  },
  block: { backgroundColor: LT.mist, borderRadius: LT_RADIUS.input },
  kicker: { width: "36%", height: 12, borderRadius: 3 },
  display: { width: "48%", height: 32 },
  line: { width: "70%", height: 16 },
  lineShort: { width: "55%", height: 12, borderRadius: 3 },
  countdown: { alignSelf: "stretch", height: 52 },
  window: { alignSelf: "stretch", height: 72, marginTop: 8 },
});

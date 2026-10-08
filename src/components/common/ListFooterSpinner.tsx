import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** One full pulse of each dot, matching the skeleton's 1.4s rhythm. */
const HALF_PULSE_MS = 700;
/** Each dot starts this much after the one before it. */
const STAGGER_MS = 180;
const DOT_LOW = 0.3;

/**
 * The "next page is on the wire" row at the foot of an endless list — three
 * pulsing dots (Marquee: "loading is a pulse, never a spinner"), spelled once
 * so every paged list (watch history, notifications, the wallet ledgers, a
 * category) ends the same way. Renders nothing while idle, so a list that has
 * reached its last page ends flush against its own bottom padding. Reduce
 * motion: the dots hold still.
 *
 * The name is historical — it is no longer a spinner — and kept so no import
 * changes.
 *
 * Hand `ListFooterComponent` the ELEMENT, built under a `useMemo` keyed on
 * `isFetchingNextPage`. FlatList is a PureComponent that compares the prop by
 * identity, so a fresh `<ListFooterSpinner/>` per render (or an inline arrow)
 * would count as a changed prop on every parent render; memoized, the
 * identity only moves when the footer should appear or go.
 */
export function ListFooterSpinner({ visible }: { visible: boolean }) {
  const { t } = useLanguage();
  if (!visible) return null;
  return (
    <View
      style={styles.footer}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.common.loading}
    >
      <Dot index={0} />
      <Dot index={1} />
      <Dot index={2} />
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : DOT_LOW);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    pulse(opacity, index);
    return () => cancelAnimation(opacity);
  }, [opacity, index, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function pulse(value: SharedValue<number>, index: number) {
  value.value = DOT_LOW;
  value.value = withDelay(
    index * STAGGER_MS,
    withRepeat(withTiming(1, { duration: HALF_PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true),
  );
}

const styles = StyleSheet.create({
  /** Same vertical inset as before, so lists that end in it keep their rhythm. */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: theme.spacing.md + 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textFaint },
});

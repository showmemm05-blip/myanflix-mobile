import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FadeInView } from "@/components/ui/FadeInView";

/**
 * How far held-over results fade while the next term loads — the Marquee
 * board's 40%: visibly secondary, still readable, still tappable.
 */
const STALE_OPACITY = 0.4;

/**
 * The results region.
 *
 * Two jobs, both deliberately at this level rather than per cell. The fade-in
 * is keyed by the COMMITTED term, so it now fires once per commit rather than
 * once per settled term — thirty entering cells is a dropped frame on a
 * mid-range Android, and typing must not buy one. And placeholder pages held
 * over from the previous term dim instead of disappearing, so the fresh count
 * above them is never read as a caption for stale cards; the cards stay
 * tappable throughout.
 */
export function ResultsRegion({
  termKey,
  stale,
  children,
}: {
  termKey: string;
  stale: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const dim = useSharedValue(stale ? STALE_OPACITY : 1);

  useEffect(() => {
    const next = stale ? STALE_OPACITY : 1;
    dim.value = reduceMotion ? next : withTiming(next, { duration: 200 });
  }, [stale, dim, reduceMotion]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));

  return (
    <FadeInView key={termKey} style={styles.fill} duration={240}>
      <Animated.View style={[styles.fill, dimStyle]}>{children}</Animated.View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

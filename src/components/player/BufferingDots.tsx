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
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/theme";

/**
 * The board's `dot` keyframes: a 1s loop where each dot swells to full
 * opacity at 40% and rests at 0.3 / 0.8× scale for the rest, the three
 * staggered by 150ms. Waiting is a pulse, never a spinner (Marquee).
 */
const RISE_MS = 400;
const FALL_MS = 400;
const REST_MS = 200;
const STAGGER_MS = 150;

interface Props {
  /** Dot fill — white over the picture, near-black on the white play disc. */
  color?: string;
  /** Diameter in pt (6 on the portrait pill, 7 in landscape). */
  size?: number;
}

/**
 * Three pulsing dots — the player's one "waiting" mark: inside the buffering
 * pill and in place of the play glyph while the stream rebuffers. Reduce
 * motion holds them still at full strength. Purely decorative; whoever shows
 * it carries the spoken "Buffering…".
 */
export function BufferingDots({ color = theme.colors.text, size = 6 }: Props) {
  return (
    <View style={[styles.row, { gap: size - 1 }]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Dot index={0} color={color} size={size} />
      <Dot index={1} color={color} size={size} />
      <Dot index={2} color={color} size={size} />
    </View>
  );
}

function Dot({ index, color, size }: { index: number; color: string; size: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: RISE_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: FALL_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: REST_MS }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, index, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + 0.7 * progress.value,
    transform: [{ scale: 0.8 + 0.2 * progress.value }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});

import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { CODE_LENGTH } from "@/components/withdrawal-code/codeRules";
import { theme, withAlpha } from "@/theme";

export type CodeDotsTone = "idle" | "error" | "locked";

interface Props {
  /** How many digits are typed (0..6). */
  count: number;
  /** error: the empty dots take a soft red ring; locked: the whole row fades to 40%. */
  tone?: CodeDotsTone;
  /** Shows the pulsing ring on the dot the next digit lands in (off while an error holds the row). */
  cursor?: boolean;
  /** Changes with every refusal that should shake the row (a new number each time). 0 = never shaken. */
  shakeKey?: number;
  /** "3 of 6 digits entered" — what a screen reader hears for the row. */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** The boards' dots: 16pt, 20pt apart. */
const DOT = 16;
const GAP = 20;
const RING = 2;
/** .now: the ring breathes between 40% and full over 1.2s. */
const PULSE_HALF_MS = 600;
const PULSE_LOW = 0.4;
/** .shakeA/.shakeB: .42s, cubic-bezier(.36,.07,.19,.97), -9 / 8 / -5 / 3 / 0. */
const SHAKE_EASING = Easing.bezier(0.36, 0.07, 0.19, 0.97);
const SHAKE_STEP_MS = 84;

/**
 * Six dots for a 6-digit code: crimson once typed, a pulsing crimson ring on
 * the one the next digit lands in, and a quiet ring on the rest — or a soft
 * red ring while the last try is being refused. A refused code shakes the
 * row. Reduce motion: no pulse (the ring stays at full) and no shake; the
 * message under the row still says what happened.
 */
export function CodeDots({ count, tone = "idle", cursor = true, shakeKey = 0, accessibilityLabel, style }: Props) {
  const reduceMotion = useReducedMotion();
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey || reduceMotion) return;
    const step = (to: number) => withTiming(to, { duration: SHAKE_STEP_MS, easing: SHAKE_EASING });
    shift.value = withSequence(step(-9), step(8), step(-5), step(3), step(0));
  }, [shakeKey, reduceMotion, shift]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, tone === "locked" && styles.locked, shakeStyle, style]}
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const filled = index < count;
        const now = cursor && tone !== "locked" && !filled && index === count;
        if (now) return <CursorDot key={index} still={reduceMotion} />;
        return (
          <View
            key={index}
            style={[styles.dot, filled ? styles.filled : tone === "error" ? styles.ringError : styles.ringIdle]}
          />
        );
      })}
    </Animated.View>
  );
}

function CursorDot({ still }: { still: boolean }) {
  const glow = useSharedValue(still ? 1 : PULSE_LOW);
  useEffect(() => {
    if (still) {
      cancelAnimation(glow);
      glow.value = 1;
      return;
    }
    glow.value = PULSE_LOW;
    glow.value = withRepeat(withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(glow);
  }, [still, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View style={[styles.dot, styles.ringNow, glowStyle]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: GAP },
  locked: { opacity: 0.4 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: RING, borderColor: "transparent" },
  filled: { backgroundColor: theme.colors.primary },
  ringNow: { borderColor: theme.colors.link },
  ringError: { borderColor: withAlpha(theme.colors.danger, 0.7) },
  ringIdle: { borderColor: withAlpha(theme.colors.text, 0.3) },
});

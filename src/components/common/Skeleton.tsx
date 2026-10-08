import { useEffect } from "react";
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/theme";

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof theme.radius;
  style?: StyleProp<ViewStyle>;
}

/** Marquee: one pulse is 1.4s — 0.5 → 1 → 0.5 opacity, eased both ways. */
const HALF_PULSE_MS = 700;
const PULSE_LOW = 0.5;

/**
 * Loading placeholder block on the #1C1C23 raised fill — a slow opacity pulse
 * (never a layout animation, never a spinner), frozen to a flat, fully opaque
 * block when the OS asks for reduced motion.
 */
export function Skeleton({ width = "100%", height = 16, radius = "md", style }: Props) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(reduceMotion ? 1 : PULSE_LOW);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = PULSE_LOW;
    pulse.value = withRepeat(
      withTiming(1, { duration: HALF_PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: theme.radius[radius] }, animatedStyle, style]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: theme.colors.skeleton },
});

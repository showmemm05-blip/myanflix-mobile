import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/theme";

/**
 * The boards' busy pulse (Subscribe, the Account sheets, sign-in): a 1.2s
 * cycle per dot, 0.25 → 1 → 0.25, each dot 150ms after the one before.
 */
const HALF_PULSE_MS = 600;
const STAGGER_MS = 150;
const LOW = 0.25;

interface Props {
  /** The dots' ink — usually the label colour of the control that is busy. */
  color?: string;
  /** Dot diameter: 8pt in a 52pt button, 6–7pt in a small control or beside text. */
  size?: number;
  /** Space between dots. Defaults to three quarters of the dot. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Working on it" as three pulsing dots — Marquee draws no spinners. Purely
 * visual and hidden from screen readers: the control that shows it carries the
 * busy state and the label a screen reader hears. Under reduce motion the dots
 * hold still at full ink.
 *
 * The one shared busy indicator. The player's buffering dots keep their own
 * 1s rhythm (Player.dc.html) and the list footer keeps the skeleton's 1.4s.
 */
export function BusyDots({ color = theme.colors.text, size = 8, gap, style }: Props) {
  return (
    <View
      style={[styles.row, { gap: gap ?? size * 0.75 }, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Dot index={0} color={color} size={size} />
      <Dot index={1} color={color} size={size} />
      <Dot index={2} color={color} size={size} />
    </View>
  );
}

function Dot({ index, color, size }: { index: number; color: string; size: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : LOW);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = LOW;
    opacity.value = withDelay(
      index * STAGGER_MS,
      withRepeat(withTiming(1, { duration: HALF_PULSE_MS, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, index, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});

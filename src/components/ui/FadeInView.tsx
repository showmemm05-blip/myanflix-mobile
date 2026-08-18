import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, useReducedMotion } from "react-native-reanimated";

interface Props {
  children: ReactNode;
  delay?: number;
  duration?: number;
  /** Direction the content drifts in from. "none" = pure cross-fade (default). */
  from?: "none" | "bottom" | "top";
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance motion for a section or list item. Honours the OS "reduce motion"
 * setting by dropping straight to a fade.
 */
export function FadeInView({ children, delay = 0, duration = 320, from = "none", style }: Props) {
  const reduceMotion = useReducedMotion();

  const entering =
    reduceMotion || from === "none"
      ? FadeIn.duration(duration).delay(delay)
      : from === "bottom"
        ? FadeInDown.duration(duration).delay(delay).springify().damping(18)
        : FadeInUp.duration(duration).delay(delay).springify().damping(18);

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, useReducedMotion } from "react-native-reanimated";

/** Every board's `.rise`: cubic-bezier(.2,.8,.2,1). */
const RISE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
/** The boards' rise travels 8–16px; 12 sits in the middle. */
const RISE_DISTANCE = 12;

interface Props {
  children: ReactNode;
  delay?: number;
  duration?: number;
  /** Direction the content drifts in from. "none" = pure cross-fade (default). */
  from?: "none" | "bottom" | "top";
  /**
   * How a directional entrance moves.
   * "rise" (default) — the boards' `.rise`: a 12pt drift + fade on one eased
   * timing curve that lands without overshoot.
   * "spring" — the earlier damped spring, kept for any caller that wants it.
   */
  curve?: "rise" | "spring";
  /** Rise travel in points (default 12). Ignored by "spring" and by reduce motion. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance motion for a section or list item. Honours the OS "reduce motion"
 * setting by dropping straight to a fade.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 320,
  from = "none",
  curve = "rise",
  distance = RISE_DISTANCE,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();

  const entering =
    reduceMotion || from === "none"
      ? FadeIn.duration(duration).delay(delay)
      : curve === "spring"
        ? from === "bottom"
          ? FadeInDown.duration(duration).delay(delay).springify().damping(18)
          : FadeInUp.duration(duration).delay(delay).springify().damping(18)
        : from === "bottom"
          ? FadeInDown.duration(duration)
              .delay(delay)
              .easing(RISE_EASING)
              .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] })
          : FadeInUp.duration(duration)
              .delay(delay)
              .easing(RISE_EASING)
              .withInitialValues({ opacity: 0, transform: [{ translateY: -distance }] });

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

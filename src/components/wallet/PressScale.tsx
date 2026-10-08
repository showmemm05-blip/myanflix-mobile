import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Marquee's press: .12s ease-out to 0.96. */
const PRESS_MS = 120;
const PRESSED_SCALE = 0.96;
/** Under reduce motion a press still reads, as a dip in opacity instead of movement. */
const PRESSED_OPACITY_STILL = 0.7;

interface Props extends Omit<PressableProps, "style" | "children"> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The wallet's pressable: every tile, chip, row and button here shrinks to
 * 0.96 while held (the boards' `.press`), or dims under reduce motion. Unlike
 * the shared PressableScale it passes every Pressable prop through, so a radio,
 * a tab or a busy button keeps its accessibility role and state.
 */
export function PressScale({ children, style, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - pressed.value * (1 - PRESSED_OPACITY_STILL) }
      : { transform: [{ scale: 1 - pressed.value * (1 - PRESSED_SCALE) }] },
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: PRESS_MS });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: PRESS_MS });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

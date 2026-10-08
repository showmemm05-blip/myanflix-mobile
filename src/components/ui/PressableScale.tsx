import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Pressable, type AccessibilityRole } from "react-native";

interface Props {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** How far the target shrinks while held (default 0.96). */
  activeScale?: number;
  /** Dim as well as shrink — reads better on large artwork. */
  dimOnPress?: boolean;
  hitSlop?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The single press affordance for cards, tiles and artwork. With the OS
 * "reduce motion" setting on, the spring scale is skipped and only the
 * `dimOnPress` opacity remains, so a press still reads without movement.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  activeScale = 0.96,
  dimOnPress,
  hitSlop,
  accessibilityRole = "button",
  accessibilityLabel,
  style,
}: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        if (dimOnPress) opacity.value = withTiming(0.86, { duration: 120 });
      }}
      onPressOut={() => {
        // Unconditional reset: reduce motion may have been switched on mid-press.
        scale.value = reduceMotion ? 1 : withSpring(1, { damping: 15, stiffness: 300 });
        if (dimOnPress) opacity.value = withTiming(1, { duration: 160 });
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

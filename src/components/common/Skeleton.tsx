import { useEffect } from "react";
import { StyleSheet, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
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

/**
 * Loading placeholder block — a slow opacity pulse (never a layout animation),
 * frozen to a flat block when the OS asks for reduced motion.
 */
export function Skeleton({ width = "100%", height = 16, radius = "md", style }: Props) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
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

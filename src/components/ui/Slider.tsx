import { useEffect } from "react";
import { StyleSheet, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { theme } from "@/theme";

export interface SliderColors {
  /** Unfilled track. */
  track?: string;
  /** Filled portion + thumb tint. */
  fill?: string;
  thumb?: string;
}

interface Props {
  value: number;
  min: number;
  max: number;
  /** 0 (default) = continuous. */
  step?: number;
  /** Fires as the thumb moves (stepped, deduplicated) — for live readouts. */
  onChange?: (value: number) => void;
  /** Fires once when the finger lifts — the COMMIT; persist here, not per-frame. */
  onChangeEnd?: (value: number) => void;
  colors?: SliderColors;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const THUMB_SIZE = 20;
const TRACK_HEIGHT = 4;

/**
 * A pan-driven slider (gesture-handler + reanimated — no native slider
 * module, JS-only by law). The whole 44pt-tall row is the touch surface;
 * screen readers adjust it with increment/decrement at one step per action.
 */
export function Slider({
  value,
  min,
  max,
  step = 0,
  onChange,
  onChangeEnd,
  colors,
  accessibilityLabel,
  disabled,
  style,
}: Props) {
  const range = max - min;
  const trackWidth = useSharedValue(0);
  const fraction = useSharedValue(range > 0 ? Math.min(1, Math.max(0, (value - min) / range)) : 0);
  const dragging = useSharedValue(false);
  const lastNotified = useSharedValue(value);

  // Follow external value changes (preset chips, hydration) when not dragging.
  useEffect(() => {
    if (dragging.value) return;
    fraction.value = range > 0 ? Math.min(1, Math.max(0, (value - min) / range)) : 0;
    lastNotified.value = value;
  }, [value, min, range, fraction, dragging, lastNotified]);

  const quantize = (f: number): number => {
    "worklet";
    const raw = min + Math.min(1, Math.max(0, f)) * range;
    const stepped = step > 0 ? Math.round((raw - min) / step) * step + min : raw;
    return Math.min(max, Math.max(min, stepped));
  };

  const moveTo = (x: number) => {
    "worklet";
    if (trackWidth.value <= 0) return;
    fraction.value = Math.min(1, Math.max(0, x / trackWidth.value));
    const next = quantize(fraction.value);
    if (next !== lastNotified.value) {
      lastNotified.value = next;
      if (onChange) runOnJS(onChange)(next);
    }
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onBegin((event) => {
      dragging.value = true;
      moveTo(event.x);
    })
    .onUpdate((event) => {
      moveTo(event.x);
    })
    .onFinalize(() => {
      dragging.value = false;
      const committed = quantize(fraction.value);
      fraction.value = range > 0 ? (committed - min) / range : 0;
      if (onChangeEnd) runOnJS(onChangeEnd)(committed);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.max(0, fraction.value * trackWidth.value - THUMB_SIZE / 2) },
    ],
  }));

  const nudge = (direction: 1 | -1) => {
    const delta = step > 0 ? step : range / 10;
    const next = Math.min(max, Math.max(min, value + direction * delta));
    onChange?.(next);
    onChangeEnd?.(next);
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") nudge(1);
    else if (event.nativeEvent.actionName === "decrement") nudge(-1);
  };

  const trackColor = colors?.track ?? theme.colors.surfaceSunken;
  const fillColor = colors?.fill ?? theme.colors.primary;
  const thumbColor = colors?.thumb ?? colors?.fill ?? theme.colors.primary;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.container, disabled && styles.disabled, style]}
        onLayout={(event) => {
          trackWidth.value = event.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: range > 0 ? Math.round(((value - min) / range) * 100) : 0,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <Animated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
        </View>
        <Animated.View style={[styles.thumb, { backgroundColor: thumbColor }, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    height: theme.layout.minTouch,
    justifyContent: "center",
    alignSelf: "stretch",
  },
  disabled: { opacity: 0.45 },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    ...theme.shadow.sm,
  },
});

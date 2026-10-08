import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

interface Props {
  text: string | null | undefined;
  /** Lines shown while collapsed (the boards clamp a synopsis to 3). */
  collapsedLines?: number;
  moreLabel: string;
  lessLabel: string;
  /** Outer spacing; the default sits 16pt under the block above it (the title pages). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A synopsis clamped to a few lines with a More / Less toggle under it
 * (MovieDetail.dc.html). Whether the toggle shows at all is MEASURED, not
 * guessed from a character count: an invisible full-length copy reports its
 * real line count at the real width and text size, so a short Burmese
 * synopsis at 2× text that does wrap past three lines still gets the toggle,
 * and a long English one that fits never shows a pointless one.
 *
 * The visible copy is clamped from the FIRST frame, before the measurement is
 * in: a text that fits looks the same either way, and one that does not would
 * otherwise open in full and then snap shut, jolting everything below it.
 */
export function ExpandableText({ text, collapsedLines = 3, moreLabel, lessLabel, style }: Props) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const rotation = useSharedValue(0);
  const trimmed = text?.trim() ?? "";

  useEffect(() => {
    rotation.value = reduceMotion ? (expanded ? 180 : 0) : withTiming(expanded ? 180 : 0, { duration: 200 });
  }, [expanded, reduceMotion, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (trimmed.length === 0) return null;

  const onMeasure = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const next = event.nativeEvent.lines.length > collapsedLines;
    if (next !== overflows) setOverflows(next);
  };

  return (
    <View style={[styles.container, style]}>
      <View>
        <ThemedText
          variant="body"
          color={theme.colors.textBody}
          numberOfLines={expanded ? undefined : collapsedLines}
        >
          {trimmed}
        </ThemedText>
        {/* The measuring copy: same text, same style, no clamp, never seen or spoken. */}
        <ThemedText
          variant="body"
          onTextLayout={onMeasure}
          style={styles.measure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessible={false}
          pointerEvents="none"
        >
          {trimmed}
        </ThemedText>
      </View>

      {overflows && (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          hitSlop={{ top: 4, bottom: 4, left: 0, right: 12 }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? lessLabel : moreLabel}
          style={styles.toggle}
        >
          <ThemedText variant="muted" weight="extrabold" color={theme.colors.text}>
            {expanded ? lessLabel : moreLabel}
          </ThemedText>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  measure: { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, alignSelf: "flex-start" },
});

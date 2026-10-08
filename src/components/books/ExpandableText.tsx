import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View, type NativeSyntheticEvent, type TextLayoutEventData } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useReducedMotion } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  text: string;
  /** Lines shown while collapsed (the boards clamp a summary or bio at 3). */
  lines?: number;
}

/**
 * A long paragraph (a book's summary, an author's bio) clamped to a few lines
 * with a More / Less toggle under it — BookDetail.dc.html and
 * AuthorDetail.dc.html. The toggle appears only when the text really runs
 * past the clamp: an invisible, unclamped copy is laid out once to count its
 * lines, so a short blurb never grows a pointless "More".
 */
export function ExpandableText({ text, lines = 3 }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      setOverflows(event.nativeEvent.lines.length > lines);
    },
    [lines],
  );

  return (
    <View>
      {/* The measuring copy: same type, no clamp, never seen or spoken. */}
      <View
        style={styles.measure}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <ThemedText variant="body" onTextLayout={measure} accessible={false}>
          {text}
        </ThemedText>
      </View>

      <ThemedText variant="body" color={theme.colors.textBody} numberOfLines={expanded ? undefined : lines}>
        {text}
      </ThemedText>

      {overflows && (
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t.common.showLess : t.common.showMore}
          hitSlop={4}
          style={({ pressed }) => [styles.toggle, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}
        >
          <ThemedText variant="muted" weight="extrabold" color={theme.colors.text}>
            {expanded ? t.common.showLess : t.common.showMore}
          </ThemedText>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.xs,
    minHeight: theme.layout.minTouch,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.6 },
});

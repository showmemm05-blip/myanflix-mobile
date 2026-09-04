import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { IconButton } from "@/components/ui/IconButton";
import { ThemedText } from "@/components/ui/ThemedText";
import { tabularNums, theme, withAlpha } from "@/theme";
import type { ReaderThemeColors } from "@/components/books/readerThemes";

interface Props {
  visible: boolean;
  colors: ReaderThemeColors;
  /** One translated sentence — "Chapter {c} of {t}" / "{p} / {t}". */
  /** Null hides the counter (e.g. a chapter with no pages yet). */
  label: string | null;
  /** PageReader: tapping the label opens the jump-to-page sheet. */
  onPressLabel?: () => void;
  labelAccessibilityLabel?: string;
  /** PageReader's page-turn chevrons; ChapterReader omits both. */
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  prevAccessibilityLabel?: string;
  nextAccessibilityLabel?: string;
}

/** The readers' auto-hiding bottom bar — same translucent treatment as the top bar. */
export function ReaderFooter({
  visible,
  colors,
  label,
  onPressLabel,
  labelAccessibilityLabel,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  prevAccessibilityLabel,
  nextAccessibilityLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: 180 }),
  }));

  const labelText = (
    <ThemedText
      variant="caption"
      numberOfLines={1}
      style={[styles.label, tabularNums, { color: colors.muted }]}
    >
      {label}
    </ThemedText>
  );

  return (
    <Animated.View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.sm), backgroundColor: withAlpha(colors.bg, 0.92) },
        animatedStyle,
      ]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={styles.row}>
        {onPrev && (
          <IconButton
            icon="chevron-back"
            variant="ghost"
            size="sm"
            color={colors.ink}
            onPress={onPrev}
            disabled={prevDisabled}
            accessibilityLabel={prevAccessibilityLabel}
          />
        )}
        {onPressLabel ? (
          <Pressable
            onPress={onPressLabel}
            style={styles.labelButton}
            accessibilityRole="button"
            accessibilityLabel={labelAccessibilityLabel ?? label ?? undefined}
          >
            {labelText}
          </Pressable>
        ) : (
          <View style={styles.labelButton}>{labelText}</View>
        )}
        {onNext && (
          <IconButton
            icon="chevron-forward"
            variant="ghost"
            size="sm"
            color={colors.ink}
            onPress={onNext}
            disabled={nextDisabled}
            accessibilityLabel={nextAccessibilityLabel}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  labelButton: {
    flex: 1,
    minHeight: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
});

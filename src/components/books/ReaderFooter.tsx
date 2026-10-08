import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { IconButton } from "@/components/ui/IconButton";
import { ThemedText } from "@/components/ui/ThemedText";
import { clamp } from "@/utils/format";
import { tabularNums, theme, withAlpha } from "@/theme";
import type { ReaderThemeColors } from "@/components/books/readerThemes";

interface Props {
  visible: boolean;
  colors: ReaderThemeColors;
  /** One translated sentence — "Chapter {c} of {t} · {p}%" / "{p} / {t}". */
  /** Null hides the counter (e.g. a chapter with no pages yet). */
  label: string | null;
  /**
   * 0–1, drawn as Marquee's thin crimson line over the label — the chapter's
   * depth in the text reader, page / total in the page reader. Visual only,
   * from values the readers already compute; null draws an empty track.
   */
  progress?: number | null;
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

/**
 * The readers' auto-hiding bottom bar (BookReader.dc.html / PageReader.dc.html):
 * the page colour at 94% with a hairline over it, a 3pt progress line, and
 * the position in words — with the page-turn chevrons either side of it in
 * the page reader, where the position is also the "Go to page" button.
 */
export function ReaderFooter({
  visible,
  colors,
  label,
  progress,
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
  const paged = !!onPrev || !!onNext;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: 180 }),
  }));

  const fill = typeof progress === "number" && Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;

  const labelText = (
    <ThemedText
      variant={paged ? "muted" : "caption"}
      weight={paged ? "bold" : "semibold"}
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
        paged ? styles.barPaged : styles.barText,
        {
          paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          backgroundColor: withAlpha(colors.bg, 0.94),
          borderTopColor: colors.rule,
        },
        animatedStyle,
      ]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={[styles.track, { backgroundColor: colors.rule }]} pointerEvents="none">
        <View style={[styles.fill, { width: `${fill * 100}%` }]} />
      </View>

      <View style={paged ? styles.rowPaged : styles.rowText}>
        {onPrev && (
          <IconButton
            icon="chevron-back"
            variant="ghost"
            size="md"
            color={colors.ink}
            onPress={onPrev}
            disabled={prevDisabled}
            accessibilityLabel={prevAccessibilityLabel}
          />
        )}
        {onPressLabel ? (
          <Pressable
            onPress={onPressLabel}
            style={({ pressed }) => [styles.labelButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={labelAccessibilityLabel ?? label ?? undefined}
          >
            {labelText}
          </Pressable>
        ) : (
          <View style={paged ? styles.labelButton : styles.labelPlain}>{labelText}</View>
        )}
        {onNext && (
          <IconButton
            icon="chevron-forward"
            variant="ghost"
            size="md"
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barText: { paddingTop: theme.spacing.md },
  barPaged: { paddingTop: 14 },
  track: { height: 3, marginHorizontal: 20, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2, backgroundColor: theme.colors.primary },
  rowText: { paddingTop: 12, paddingBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  rowPaged: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: 9,
    paddingHorizontal: 12,
  },
  labelButton: {
    flex: 1,
    minHeight: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.layout.minTouch / 2,
  },
  labelPlain: { alignItems: "center" },
  label: { textAlign: "center" },
  pressed: { opacity: 0.6 },
});

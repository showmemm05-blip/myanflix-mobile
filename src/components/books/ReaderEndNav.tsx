import { Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { ReaderThemeColors } from "@/components/books/readerThemes";
import type { BookChapterSummary } from "@/types/book";

interface Props {
  colors: ReaderThemeColors;
  previous: BookChapterSummary | null;
  next: BookChapterSummary | null;
  onGo: (chapterId: string) => void;
}

/**
 * The end-of-chapter way on (BookReader.dc.html "chapterEnd"): the previous
 * chapter as a quiet card on the page's rule tint, the next one as a card
 * filled with the page's INK — the way forward is the loud one. With no next
 * chapter the reader is told they have reached the end. A chapter that is not
 * READY yet stays visible but inert, exactly as the outline buttons were.
 */
export function ReaderEndNav({ colors, previous, next, onGo }: Props) {
  const { t } = useLanguage();
  const r = t.books.reader;
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.nav}>
      {previous && (
        <Pressable
          onPress={() => onGo(previous.id)}
          disabled={previous.status !== "READY"}
          accessibilityRole="button"
          accessibilityLabel={r.previousChapter}
          accessibilityState={{ disabled: previous.status !== "READY" }}
          style={({ pressed }) => [
            styles.card,
            styles.previous,
            { backgroundColor: colors.rule },
            previous.status !== "READY" && styles.disabled,
            pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
          <View style={styles.text}>
            <ThemedText variant="label" weight="regular" style={[styles.kicker, { color: colors.muted }]}>
              {r.previousChapter}
            </ThemedText>
            <ThemedText variant="body" weight="bold" numberOfLines={2} style={{ color: colors.ink }}>
              {previous.title}
            </ThemedText>
          </View>
        </Pressable>
      )}
      {next ? (
        <Pressable
          onPress={() => onGo(next.id)}
          disabled={next.status !== "READY"}
          accessibilityRole="button"
          accessibilityLabel={r.nextChapter}
          accessibilityState={{ disabled: next.status !== "READY" }}
          style={({ pressed }) => [
            styles.card,
            styles.next,
            { backgroundColor: colors.ink },
            next.status !== "READY" && styles.disabled,
            pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
          ]}
        >
          <View style={styles.text}>
            <ThemedText variant="label" weight="semibold" style={[styles.kicker, { color: colors.bg }]}>
              {next.status === "READY" ? r.nextChapter : `${r.nextChapter} · ${t.books.chapterComingSoon}`}
            </ThemedText>
            <ThemedText variant="body" weight="extrabold" numberOfLines={2} style={{ color: colors.bg }}>
              {next.title}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.bg} />
        </Pressable>
      ) : (
        <ThemedText variant="caption" style={[styles.finished, { color: colors.muted }]}>
          {r.finished}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { gap: 10, alignSelf: "stretch" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
  },
  previous: { paddingLeft: 12, paddingRight: theme.spacing.md },
  next: { justifyContent: "space-between", paddingLeft: theme.spacing.md, paddingRight: 12 },
  text: { flex: 1 },
  kicker: { letterSpacing: 0 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  pressedStill: { opacity: 0.7 },
  finished: { textAlign: "center", paddingVertical: theme.spacing.md },
});

import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Chip } from "@/components/common/Chip";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  terms: readonly string[];
  /** A chip IS the search — the screen commits the term on tap. */
  onReplay: (term: string) => void;
  onClear: () => void;
}

/**
 * "Recent searches" — the heading with Clear on its right, then one sideways
 * rail of clock chips (the boards' rail, in place of the old wrapping block).
 * In-memory only: the screen owns the list (max six) and nothing is persisted.
 * A rail never truncates a chip, so a long Burmese term stays whole.
 */
export const RecentSearches = memo(function RecentSearches({ terms, onReplay, onClear }: Props) {
  const { t } = useLanguage();
  return (
    <View>
      <View style={styles.header}>
        <ThemedText variant="section" accessibilityRole="header" style={styles.title}>
          {t.search.recent}
        </ThemedText>
        <Pressable
          onPress={onClear}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t.search.clearRecentA11y}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <ThemedText variant="muted" weight="extrabold" color={theme.colors.link}>
            {t.search.clearRecent}
          </ThemedText>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.railScroll}
        contentContainerStyle={styles.rail}
        keyboardShouldPersistTaps="handled"
      >
        {terms.map((term) => (
          <Chip
            key={term}
            label={term}
            icon="time-outline"
            onPress={() => onReplay(term)}
            accessibilityLabel={t.search.searchAgainA11y.replace("{term}", term)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    paddingLeft: theme.layout.screenPadding,
    paddingRight: theme.spacing.sm,
  },
  title: { flexShrink: 1 },
  clear: {
    minHeight: theme.layout.minTouch,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: { opacity: 0.7 },
  /** 44pt of rail for a 34pt chip — the Chip's own hitSlop fills the rest. */
  rail: {
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.layout.screenPadding,
  },
  railScroll: { marginTop: theme.spacing.xs },
});

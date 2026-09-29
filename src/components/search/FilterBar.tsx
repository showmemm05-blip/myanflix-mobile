import { Pressable, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/*
 * The Media tab's ONE filter control, its neighbour pill, and its one line of
 * feedback. The Filter button sits on the right of the results header and
 * opens the SearchFilters page; the People button sits immediately left of it
 * and opens a list of names — the actors list on Movies and Series, the
 * authors list on Books (its own screen since the People tab was dropped —
 * six tabs overflowed the strip); the summary sits under the tab strip and
 * names what the filters page has applied, with a Clear link beside it. None
 * of them edits a filter itself — the page writes the store, the screen
 * resets it — so all three stay stateless.
 */

interface FilterButtonProps {
  /** Active filters on the visible tab — shown as "Filter · 2" once > 0. */
  count: number;
  onPress: () => void;
}

/** The "Filter" / "Filter · 2" pill on the right of the results header. */
export function FilterButton({ count, onPress }: FilterButtonProps) {
  const { t } = useLanguage();
  const label = count > 0 ? `${t.search.filterButton} · ${count}` : t.search.filterButton;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t.search.filters}
      style={({ pressed }) => [styles.button, count > 0 && styles.buttonActive, pressed && styles.pressed]}
    >
      <Ionicons name="options-outline" size={15} color={count > 0 ? theme.colors.primary : theme.colors.text} />
      <ThemedText
        variant="label"
        weight="semibold"
        numberOfLines={1}
        color={count > 0 ? theme.colors.primary : theme.colors.text}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

interface PeopleButtonProps {
  onPress: () => void;
  /**
   * What the pill says and shows. It is CONTEXTUAL: on Movies and Series it is
   * the People button that opens the actors list; on Books it is Authors, and
   * opens the authors list — a book has an author, not a cast. The caller
   * supplies both because the caller is the only place that knows which tab is
   * on screen; the defaults keep it the People button for anyone who passes
   * neither. The label doubles as the accessibility label, so the two can
   * never disagree.
   */
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * The people/authors pill beside the Filter button — the door to whichever
 * list of names the visible tab is about.
 */
export function PeopleButton({ onPress, label, icon = "people-outline" }: PeopleButtonProps) {
  const { t } = useLanguage();
  const text = label ?? t.search.people;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={text}
      /* Deliberately the SAME `button` style as FilterButton above, not a copy
         of its numbers: the two sit side by side in the results header and
         have to read as one pair, so a change to the pill has to move both. */
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={theme.colors.text} />
      <ThemedText variant="label" weight="semibold" numberOfLines={1} color={theme.colors.text}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

interface FilterSummaryProps {
  /** One short line — "Action, Comedy · Top rated · 2010s" (see summarizeMovieFilters). */
  text: string;
  onClear: () => void;
}

/**
 * The caption under the tab strip while any filter is active: the summary on
 * the left, "Clear" on the right. The screen drops the row entirely when the
 * summary is null, so this never renders an empty line.
 */
export function FilterSummary({ text, onClear }: FilterSummaryProps) {
  const { t } = useLanguage();
  return (
    <View style={styles.summaryRow}>
      <ThemedText variant="caption" numberOfLines={1} style={styles.summaryText}>
        {text}
      </ThemedText>
      <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" style={styles.clear}>
        <ThemedText variant="caption" weight="semibold" color={theme.colors.primary}>
          {t.search.clearFilters}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceElevated,
  },
  buttonActive: { borderColor: theme.colors.primary },
  pressed: { opacity: 0.7 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xs,
  },
  summaryText: { flex: 1 },
  /** The link's slack is vertical only, so the summary keeps the row's width. */
  clear: { minHeight: 32, justifyContent: "center", paddingLeft: theme.spacing.xs },
});

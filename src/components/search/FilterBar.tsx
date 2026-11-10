import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { GlassFace } from "@/components/layout/GlassFace";
import type { FilterChip } from "@/components/search/filters";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/*
 * The filter controls, in Liquid Glass (the owner, 2026-11-10: "do the same
 * glass for search page filters"): every pill wears the top-bar buttons'
 * glass (GlassFace) with white ink, at its own 34pt height so no row moves.
 * The "Sort & filter" pill opens the
 * Sort & filter sheet. The filter ROW (the Media page's results view and the
 * search screen) repeats that pill, then one chip per active value — each
 * with its ✕, removing that value in place — and Clear all. The People pill
 * is the SEARCH SCREEN's only (its count row, SearchResultsHeader): a list of
 * names — the actors on Movies and Series, the authors on Books. The Media
 * page has no People filter (people are reached by search and title pages,
 * as on Netflix). All of them stay stateless: the caller owns the filters.
 */

/** The visible pill; hitSlop tops each one up to the 44pt target. */
const PILL_HEIGHT = 34;
const PILL_SLOP = { top: 5, bottom: 5, left: 0, right: 0 };

/**
 * One pressable 34pt glass pill — the shape every control in this file
 * shares. `active` is the same glass tinted red (the top bar's picked
 * category). Pressed, it shrinks to 96%; under Reduce Motion it stays put and
 * the glass lights up instead. It never dims: an iOS blur under a parent with
 * alpha < 1 renders broken (GlassFace explains).
 */
function PillPressable({
  onPress,
  accessibilityLabel,
  active,
  children,
  compactRight,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  children: ReactNode;
  /** The chips carry a trailing ✕, so their right padding is tighter. */
  compactRight?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={PILL_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.pill,
        compactRight ? styles.pillChip : styles.pillButton,
        pressed && !reduceMotion && styles.pressed,
      ]}
    >
      {({ pressed }) => (
        <>
          <GlassFace radius={PILL_HEIGHT / 2} picked={active} pressed={reduceMotion && pressed} />
          {children}
        </>
      )}
    </Pressable>
  );
}

interface FilterButtonProps {
  /** Active values the pill stands for — drawn as its count badge once > 0. */
  count: number;
  onPress: () => void;
}

/**
 * THE one "Sort & filter" pill. While anything is active it is red glass and
 * carries a round white count badge; the count is part of its spoken label
 * ("Sort & filter, 2 active"), so the badge itself is not read twice.
 */
export function FilterButton({ count, onPress }: FilterButtonProps) {
  const { t } = useLanguage();
  const active = count > 0;
  const ink = theme.colors.text;
  return (
    <PillPressable
      onPress={onPress}
      active={active}
      accessibilityLabel={active ? t.search.sortAndFilterActiveA11y.replace("{n}", String(count)) : t.search.sortAndFilter}
    >
      <Ionicons name="options-outline" size={16} color={ink} />
      <ThemedText variant="muted" weight="extrabold" numberOfLines={1} color={ink}>
        {t.search.sortAndFilter}
      </ThemedText>
      {active ? (
        <View style={styles.badge}>
          <ThemedText variant="caption" weight="extrabold" tabular numberOfLines={1} color={theme.colors.onPlay}>
            {count}
          </ThemedText>
        </View>
      ) : null}
    </PillPressable>
  );
}

interface PeopleButtonProps {
  onPress: () => void;
  /**
   * What the pill says and shows. It is CONTEXTUAL: on Movies and Series it is
   * the People button that opens the actors list; on Books it is Authors, and
   * opens the authors list — a book has an author, not a cast. The label
   * doubles as the accessibility label, so the two can never disagree.
   */
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** The people/authors pill — the door to whichever list of names the tab is about. */
export function PeopleButton({ onPress, label, icon = "people-outline" }: PeopleButtonProps) {
  const { t } = useLanguage();
  const text = label ?? t.search.people;
  return (
    <PillPressable onPress={onPress} accessibilityLabel={text}>
      <Ionicons name={icon} size={16} color={theme.colors.text} />
      <ThemedText variant="muted" weight="bold" numberOfLines={1} color={theme.colors.text}>
        {text}
      </ThemedText>
    </PillPressable>
  );
}

interface FilterRowProps {
  /** The Sort & filter pill's count. */
  count: number;
  /** One per active value — see movieFilterChips / seriesFilterChips. Each removes itself. */
  chips: readonly FilterChip[];
  /** The Sort & filter pill: the sheet. */
  onEdit: () => void;
  /** Clear all: every value the chips stand for. */
  onClear: () => void;
}

/**
 * The filter row — above a Media results grid, and under the search screen's
 * scope pills: the Sort & filter pill, then — while anything is active — a
 * hairline, one chip per value (its ✕ removes just that value) and Clear
 * all. One sideways rail, so a long list of values (or long Burmese labels)
 * scrolls instead of being cut.
 */
export function FilterRow({ count, chips, onEdit, onClear }: FilterRowProps) {
  const { t } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      style={styles.rowScroll}
    >
      <FilterButton count={count} onPress={onEdit} />
      {chips.length > 0 ? (
        <>
          <View style={styles.divider} />
          {chips.map((chip) => (
            <PillPressable
              key={chip.key}
              onPress={chip.onRemove}
              compactRight
              accessibilityLabel={t.search.removeFilterA11y.replace("{label}", chip.label)}
            >
              <ThemedText variant="muted" weight="semibold" numberOfLines={1} color={theme.colors.text}>
                {chip.label}
              </ThemedText>
              <Ionicons name="close" size={14} color={theme.colors.textMuted} />
            </PillPressable>
          ))}
          {/* A glass pill like the rest, with white words: red words on glass over a white poster would not read. */}
          <PillPressable onPress={onClear} accessibilityLabel={t.search.clearFiltersA11y}>
            <ThemedText variant="muted" weight="extrabold" numberOfLines={1} color={theme.colors.text}>
              {t.search.clearAll}
            </ThemedText>
          </PillPressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** No fill of its own and not clipped: GlassFace draws the glass and clips its own layers, and its shadow falls outside. */
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
  },
  pillButton: { paddingLeft: 12, paddingRight: 14 },
  pillChip: { gap: theme.spacing.xs, paddingLeft: 14, paddingRight: 10 },
  /** The count: a white pill with dark ink on the red glass, growing with the text (2× type never clips it). */
  badge: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.play,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  rowScroll: { flexGrow: 0 },
  row: {
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.layout.screenPadding,
  },
  divider: { width: 1, height: 22, backgroundColor: theme.colors.tonalStrong },
});

import { memo, type RefObject } from "react";
import { ScrollView, StyleSheet, type ViewInstance } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FadeInView } from "@/components/ui/FadeInView";
import { GlassChip } from "@/components/hub/GlassChip";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * The Netflix row a results view shows instead of the plain Categories chip:
 * a round ✕ (back to browse, every filter cleared) and the picked genre or
 * category highlighted with a ▾ that reopens the Categories overlay — or
 * plain "Categories ▾" when nothing is picked (a shelf's See all).
 */
export interface MediaCategoriesSelection {
  /** The picked genre / category's name, or null. */
  pick: string | null;
  onClear: () => void;
}

interface Props {
  /** Opens the Categories pop-up (Movies · Series · Books) — from every section. */
  onCategories: () => void;
  /**
   * Attached to whichever chip opens the pop-up right now ("Categories ▾"
   * on browse, the picked name on a results view), so the Media screen can
   * hand screen-reader focus back to it when the pop-up closes.
   */
  categoriesRef?: RefObject<ViewInstance | null>;
  /** Set while Movies or Series is showing its results view. */
  selection?: MediaCategoriesSelection | null;
  /** The section's name — spoken on the ✕ ("Clear, back to Movies") and on the greyed pill ("…not available for Music"). */
  typeLabel: string;
  /** Music: no categories, so the pill is greyed and not pressable (MediaMusic.dc.html). */
  disabled?: boolean;
}

/**
 * The right column of a section page's section row (Main.dc.html,
 * 2026-10-22: "‹ Media | Movies | Categories ▾"), laid over the hero, so
 * every chip is a Liquid Glass pill (GlassChip; the "Top bar" board,
 * 2026-11-10: 15pt bold words, 16pt chevrons, a 40pt ✕ circle).
 *
 * Browse: the Categories button alone — a 40pt glass circle with the grid
 * icon (the owner, 2026-11-10: "change categories to icon", option 1 on the
 * "Categories icon" board), still spoken as "Categories"; on Music, which has
 * no categories, greyed and not pressable, saying so (MediaMusic.dc.html).
 *
 * Results (Movies / Series, the Netflix way): ✕ · "Drama ▾" — the picked
 * name stays written out, so the viewer always sees the list is filtered (a
 * shelf's See all, with nothing picked, shows ✕ · the grid icon). The ✕ goes
 * back to browse and the pick — red-tinted glass — reopens the Categories overlay;
 * the bar's heading names the section. The two cross-fade (a plain swap under
 * reduce motion). The fade sits on the pills' parent, so on iOS their blur
 * may look flat for those 220ms; it always did.
 *
 * One sideways rail, right-aligned: at 2× text or in Burmese it gives way
 * and scrolls (CenteredTitleRow shrinks its column first) rather than ever
 * cutting a label or pushing the title.
 *
 * A scroll view clips everything to its frame, so the pills' soft shadow
 * (6pt down, 16pt blur) is cut 2pt below them, at the edge of their 44pt
 * targets. That is on purpose: the rail's frame must be exactly the chips'
 * targets. Any extra room around them (an earlier try reached 14pt below and
 * 10pt to the sides) is still part of the scroll view, so on iOS it took the
 * taps and swipes meant for the hero and the posters under the bar, where the
 * bar should let them through (review S1/A2, 2026-11-10). (`overflow:
 * "visible"` is no way out either: on a scroll view it also changes how Yoga
 * measures the content, so the rail would stop scrolling and squeeze the
 * labels instead.)
 */
/** The Categories button's icon: four squares, "groups to browse" (the owner's pick, 2026-11-10). */
const CATEGORIES_ICON = "grid-outline";
/** Larger than the ✕'s 16pt glyph: the grid's thin squares need it to read at the same weight. */
const CATEGORIES_ICON_SIZE = 20;

export const MediaCategoriesRow = memo(function MediaCategoriesRow({
  onCategories,
  categoriesRef,
  selection,
  typeLabel,
  disabled = false,
}: Props) {
  const { t } = useLanguage();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.rail}
      contentContainerStyle={styles.row}
    >
      {selection ? (
        <FadeInView key="results" duration={220} style={styles.group}>
          <GlassChip
            round
            onPress={selection.onClear}
            accessibilityLabel={t.hub.clearSelectionA11y.replace("{type}", typeLabel)}
          >
            <Ionicons name="close" size={16} color={theme.colors.text} />
          </GlassChip>
          {selection.pick ? (
            <GlassChip
              chipRef={categoriesRef}
              picked
              onPress={onCategories}
              accessibilityLabel={t.hub.changeCategoryA11y.replace("{name}", selection.pick)}
              trailingPad
            >
              <ThemedText variant="body" weight="extrabold" color={theme.colors.text} numberOfLines={1}>
                {selection.pick}
              </ThemedText>
              <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
            </GlassChip>
          ) : (
            <GlassChip round chipRef={categoriesRef} onPress={onCategories} accessibilityLabel={t.browse.title}>
              <Ionicons name={CATEGORIES_ICON} size={CATEGORIES_ICON_SIZE} color={theme.colors.text} />
            </GlassChip>
          )}
        </FadeInView>
      ) : (
        <FadeInView key="browse" duration={220} style={styles.group}>
          <GlassChip
            round
            chipRef={categoriesRef}
            onPress={onCategories}
            disabled={disabled}
            accessibilityLabel={
              disabled ? t.hub.categoriesUnavailableA11y.replace("{type}", typeLabel) : t.browse.title
            }
          >
            <Ionicons name={CATEGORIES_ICON} size={CATEGORIES_ICON_SIZE} color={theme.colors.text} />
          </GlassChip>
        </FadeInView>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  /**
   * As wide as its chips, and the first thing to give way (then it scrolls) —
   * never wider than its column. Its frame is exactly the chips' 44pt
   * targets: no shadow room (see the note above).
   */
  rail: { flexGrow: 0, flexShrink: 1 },
  /** The chips sit at the column's right edge; a rail wider than its frame scrolls from its left. */
  row: { flexGrow: 1, justifyContent: "flex-end", alignItems: "center" },
  group: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});

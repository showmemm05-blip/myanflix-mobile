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
 * every chip is dark glass (GlassChip).
 *
 * Browse: "Categories ▾" alone — on Music, which has no categories, greyed
 * and not pressable, saying so (MediaMusic.dc.html).
 *
 * Results (Movies / Series, the Netflix way): ✕ · "Drama ▾". The ✕ goes back
 * to browse and the ringed pick reopens the Categories overlay; the row's
 * centred title names the section. The two cross-fade (a plain swap under
 * reduce motion).
 *
 * One sideways rail, right-aligned: at 2× text or in Burmese it gives way
 * and scrolls (CenteredTitleRow shrinks its column first) rather than ever
 * cutting a label or pushing the title.
 */
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
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </GlassChip>
          <GlassChip
            chipRef={categoriesRef}
            ringed={!!selection.pick}
            onPress={onCategories}
            accessibilityLabel={
              selection.pick ? t.hub.changeCategoryA11y.replace("{name}", selection.pick) : t.browse.title
            }
            trailingPad
          >
            <ThemedText
              variant="muted"
              weight={selection.pick ? "extrabold" : "bold"}
              color={theme.colors.text}
              numberOfLines={1}
            >
              {selection.pick ?? t.browse.title}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
          </GlassChip>
        </FadeInView>
      ) : (
        <FadeInView key="browse" duration={220} style={styles.group}>
          <GlassChip
            chipRef={categoriesRef}
            onPress={onCategories}
            disabled={disabled}
            accessibilityLabel={
              disabled ? t.hub.categoriesUnavailableA11y.replace("{type}", typeLabel) : t.browse.title
            }
            trailingPad
          >
            <ThemedText variant="muted" weight="bold" color={theme.colors.text} numberOfLines={1}>
              {t.browse.title}
            </ThemedText>
            <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
          </GlassChip>
        </FadeInView>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  /** As wide as its chips, and the first thing to give way (then it scrolls) — never wider than its column. */
  rail: { flexGrow: 0, flexShrink: 1 },
  /** The chips sit at the column's right edge; a rail wider than its frame scrolls from its left. */
  row: { flexGrow: 1, justifyContent: "flex-end", alignItems: "center" },
  group: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});

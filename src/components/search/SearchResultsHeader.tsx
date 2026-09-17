import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/common/Skeleton";
import { theme } from "@/theme";

interface Props {
  /** Small uppercase line above the title. */
  kicker: string;
  /** "Results for …", or the tab's own name while nothing is typed. */
  title: string;
  /**
   * Already-phrased match count, or null while the number would be a lie —
   * a debouncing field and held-over placeholder results are both cases where
   * the total on screen belongs to the PREVIOUS term. A placeholder of the
   * same height holds the slot so the header never jumps.
   */
  countLabel: string | null;
}

/**
 * The band between the field and the grid: what was searched, and how much
 * matched.
 *
 * The count sits UNDER the title rather than beside it. Sharing one row let
 * the pill — whose width is its text, with no room to shrink — win every
 * contest against the heading: a Burmese count ("ရုပ်ရှင် ၁၂၅ ခု တွေ့ရှိသည်")
 * runs ~165pt, which on a 360pt phone truncated a 20pt heading to a few
 * glyphs and inverted the very hierarchy this band exists to state. Stacked,
 * the heading owns the full width in every language and the count reads as
 * the subordinate fact it is.
 */
export function SearchResultsHeader({ kicker, title, countLabel }: Props) {
  return (
    <View style={styles.block}>
      <ThemedText variant="overline" color={theme.colors.primary}>
        {kicker}
      </ThemedText>
      {/* Two lines, not one: a long term in a wide script wraps instead of
          being cut off mid-word. */}
      <ThemedText variant="title" numberOfLines={2}>
        {title}
      </ThemedText>
      <View style={styles.countRow}>
        {countLabel === null ? (
          <Skeleton width={148} height={28} radius="pill" />
        ) : (
          <Pill tone="primary">{countLabel}</Pill>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.md,
    gap: 2,
  },
  /** Row wrapper so the pill hugs its text instead of stretching the band. */
  countRow: { flexDirection: "row", marginTop: theme.spacing.sm },
});

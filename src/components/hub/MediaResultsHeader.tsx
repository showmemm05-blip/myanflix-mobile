import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { FilterRow } from "@/components/search/FilterBar";
import type { FilterChip } from "@/components/search/filters";
import { theme } from "@/theme";

interface Props {
  /**
   * "128 movies" — the server's total for the grid below. Null while that
   * number is not known yet, or belongs to the previous filter (a skeleton
   * bar holds its place); an empty string when there is none (the list failed).
   */
  countLabel: string | null;
  /** The Sort & filter pill's badge: the refinements in force. */
  filterCount: number;
  /** One removable chip per refinement. */
  chips: readonly FilterChip[];
  onOpenSheet: () => void;
  /** Clear all: every refinement (the genre or category the page shows stays). */
  onClearAll: () => void;
}

/**
 * Under a Media results view's title: the count, then the filter row — the
 * "Sort & filter" pill (with its count), a removable chip per active
 * refinement and Clear all. Quiet on purpose: with nothing refined it is a
 * single pill.
 */
export function MediaResultsHeader({ countLabel, filterCount, chips, onOpenSheet, onClearAll }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.count}>
        {countLabel === null ? (
          <Skeleton width={110} height={14} radius="xs" />
        ) : countLabel ? (
          <ThemedText variant="caption" weight="semibold" tabular color={theme.colors.textMuted} accessibilityLiveRegion="polite">
            {countLabel}
          </ThemedText>
        ) : null}
      </View>
      <FilterRow count={filterCount} chips={chips} onEdit={onOpenSheet} onClear={onClearAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.xs },
  /** 18pt even before the number lands, so the row under it never jumps. */
  count: { minHeight: 18, justifyContent: "center", paddingHorizontal: theme.layout.screenPadding },
});

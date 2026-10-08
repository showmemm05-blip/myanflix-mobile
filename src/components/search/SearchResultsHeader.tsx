import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Type-only here, but
// the rule is the same. Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Skeleton } from "@/components/common/Skeleton";
import { FilterButton, PeopleButton } from "@/components/search/FilterBar";
import { theme } from "@/theme";

interface Props {
  /**
   * Already-phrased match count — "12 results for “inception”", "12 movies" —
   * or null while the number would be a lie: held-over placeholder results
   * belong to the PREVIOUS term. A null draws a skeleton bar in its place, so
   * the row keeps its height and the list never jumps.
   */
  countLabel: string | null;
  /**
   * The Sort & filter pill — passed only while the filter row under the tabs is NOT
   * showing (an idle, unfiltered list), so the control is never drawn twice.
   */
  filter?: {
    /** Active filters on this tab — the Sort & filter pill's count badge. */
    count: number;
    onPress: () => void;
  };
  /**
   * The names pill. CONTEXTUAL: "People" (actors list) on Movies and Series,
   * "Authors" (authors list) on Books. Omitted where there is nowhere to go.
   */
  people?: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

/**
 * The row between the tabs and the first result: the count on the left, the
 * pills on the right. The count may wrap to two lines and the pill group may
 * drop under it on a narrow phone at large text — a label is never cut.
 */
export function SearchResultsHeader({ countLabel, filter, people }: Props) {
  return (
    <View style={styles.row}>
      {countLabel === null ? (
        <View style={styles.count}>
          <Skeleton width="80%" height={16} radius="xs" style={styles.countSkeleton} />
        </View>
      ) : (
        <ThemedText
          weight="extrabold"
          tabular
          numberOfLines={2}
          accessibilityLiveRegion="polite"
          style={styles.count}
        >
          {countLabel}
        </ThemedText>
      )}
      {people || filter ? (
        <View style={styles.actions}>
          {people && <PeopleButton onPress={people.onPress} label={people.label} icon={people.icon} />}
          {filter && <FilterButton count={filter.count} onPress={filter.onPress} />}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Wrapping on purpose. The count has a zero basis and a floor, so normally
   * it shares the line with the pills and takes whatever they leave; only
   * when floor + pills cannot fit does the pill group move to a second line.
   */
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing.xs,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.layout.screenPadding,
  },
  count: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 96 },
  countSkeleton: { maxWidth: 170 },
  /** Wraps too: two pills at 2× text can be wider than a 320pt phone. */
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
    maxWidth: "100%",
  },
});

import { StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Type-only here, but
// the rule is the same. Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FilterButton, PeopleButton } from "@/components/search/FilterBar";
import { theme } from "@/theme";

interface Props {
  /**
   * Already-phrased match count — "12 results for “inception”", "12 movies" —
   * or null while the number would be a lie: held-over placeholder results
   * belong to the PREVIOUS term, and a loading list has no number yet. The
   * row keeps its height either way so the list never jumps.
   */
  countLabel: string | null;
  /** The Filter button on the right — omitted on tabs with no filters (books). */
  filter?: {
    /** Active filters on this tab, so the button can read "Filter · 2". */
    count: number;
    onPress: () => void;
  };
  /**
   * The names button, drawn to the LEFT of Filter. CONTEXTUAL, which is why it
   * carries its own label and glyph rather than just a handler: on Movies and
   * Series it is "People" and opens the actors list; on Books it is "Authors"
   * and opens the authors list. Shaped like `filter` above so the two controls
   * read the same way at the call site. Omitted where there is nowhere to go;
   * on Books, where `filter` is absent, it is the only control in the group
   * and still shows.
   */
  people?: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
}

/**
 * The row between the field and the first result: the count on the left, the
 * buttons on the right. One line, not the old three-block band — the owner
 * asked for the header to stop eating the space above the fold.
 *
 * The count is a caption that may ellipsize and gives way first. With TWO
 * pills on the right, though, `flex: 1` alone left it nothing to show on a
 * narrow phone — Burmese labels are wider — so it keeps a floor and the button
 * group is allowed to shrink past it, letting a pill's own label ellipsize
 * rather than erasing the only statement of how many results there are.
 * The names pill and Filter sit in one group with a small gap so the pair
 * reads as a pair rather than as two things that happen to be on the same
 * side.
 */
export function SearchResultsHeader({ countLabel, filter, people }: Props) {
  return (
    <View style={styles.row}>
      <ThemedText variant="caption" numberOfLines={1} style={styles.count}>
        {countLabel ?? ""}
      </ThemedText>
      <View style={styles.actions}>
        {people && <PeopleButton onPress={people.onPress} label={people.label} icon={people.icon} />}
        {filter && <FilterButton count={filter.count} onPress={filter.onPress} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: 30,
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xs,
  },
  /** `minWidth` is the floor the pills may not push it below. */
  count: { flex: 1, minWidth: 72 },
  /**
   * Empty when neither control is passed, which costs no width and no height.
   * `flexShrink` because RN defaults it to 0: without it the pair would keep
   * its full width and the count would absorb every pixel of a tight row.
   */
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
});

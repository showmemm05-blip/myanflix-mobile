import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/common/Skeleton";
import type { PosterGridLayout } from "@/hooks/usePosterGrid";
import { theme } from "@/theme";

/**
 * The people-grid loading state — discs the exact diameter of an ActorAvatar
 * cell with the name and count lines under them, laid out on the grid's own
 * columns, so nothing shifts when the first page lands. Serves BOTH name
 * lists: ActorsList and its books twin AuthorsList, which are the same screen
 * with a different noun.
 *
 * It used to live in components/search/ResultsSkeleton.tsx as
 * ResultsPeopleSkeleton, back when People was a tab of the Media screen and
 * the skeleton had to draw that screen's results-header silhouette on top.
 * The list is its own screen now, with a REAL top bar and search field above
 * it, so the header row went and the file moved beside the screen it serves —
 * it is not a search-results skeleton any more.
 */
export function ActorGridSkeleton({ grid, avatar }: { grid: PosterGridLayout; avatar: number }) {
  const cells = Math.min(18, Math.max(6, grid.columns * 3));
  return (
    <>
    {/* The real list opens with a count caption; without its silhouette the
        first row of faces jumped up the screen when the page landed. */}
    <View style={styles.countRow}>
      <Skeleton width={110} height={12} radius="sm" />
    </View>
    <View style={[styles.grid, { gap: grid.gap, rowGap: theme.spacing.lg }]}>
      {Array.from({ length: cells }).map((_, index) => (
        <View key={index} style={[styles.person, { width: grid.cellWidth }]}>
          <Skeleton width={avatar} height={avatar} radius="pill" />
          <Skeleton width={"80%"} height={12} radius="sm" />
          <Skeleton width={"55%"} height={10} radius="sm" />
        </View>
      ))}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
  },
  countRow: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.sm },
  /** One cell's silhouette — centred, like the real cell's disc and labels. */
  person: { alignItems: "center", gap: theme.spacing.xs },
});

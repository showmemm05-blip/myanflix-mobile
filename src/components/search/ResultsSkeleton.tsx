import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/common/Skeleton";
import { MediaCardSkeleton } from "@/components/common/MediaCard";
import { ListCardSkeleton } from "@/components/search/ListCard";
import type { PosterGridLayout } from "@/hooks/usePosterGrid";
import { theme } from "@/theme";

/** Rows a first screenful of list cards holds — the fold on a phone, roughly. */
const LIST_SKELETON_ROWS = 4;

/**
 * The results header's silhouette — the count on the left, the button pair on
 * the right. Every tab that shows this header now carries a People pill;
 * Books has no filters, so it carries only that one. Drawing the real number
 * of pills is the whole point: a silhouette that promises a control the
 * header does not land, or hides one it does, reflows the row on arrival.
 */
function HeaderSkeleton({ filter = true }: { filter?: boolean }) {
  return (
    <View style={styles.header}>
      <Skeleton width={150} height={13} radius="sm" />
      <View style={styles.headerActions}>
        <Skeleton width={92} height={30} radius="pill" />
        {filter ? <Skeleton width={98} height={30} radius="pill" /> : null}
      </View>
    </View>
  );
}

/**
 * The loading state of the movie and series tabs — rows the exact height of
 * a resting list card, under the header row, so nothing shifts when the real
 * content lands.
 */
export function ResultsListSkeleton() {
  return (
    <View style={styles.screen}>
      <HeaderSkeleton />
      <View style={styles.list}>
        {Array.from({ length: LIST_SKELETON_ROWS }).map((_, index) => (
          <ListCardSkeleton key={index} />
        ))}
      </View>
    </View>
  );
}

/**
 * The books tab's loading state, shaped like the grid it is standing in for —
 * same columns, same cell width, same gaps, and the header row on top.
 */
export function ResultsSkeleton({ grid }: { grid: PosterGridLayout }) {
  const cells = Math.min(12, Math.max(6, grid.columns * 3));
  return (
    <View style={styles.screen}>
      <HeaderSkeleton filter={false} />
      <View style={[styles.grid, { gap: grid.gap, rowGap: theme.spacing.lg }]}>
        {Array.from({ length: cells }).map((_, index) => (
          <MediaCardSkeleton key={index} width={grid.cellWidth} metaLines={2} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  screen: { paddingTop: theme.spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 30,
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  list: { paddingHorizontal: theme.layout.screenPadding, gap: theme.spacing.sm + 2 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
  },
});

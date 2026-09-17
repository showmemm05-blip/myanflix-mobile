import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/common/Skeleton";
import { MediaCardSkeleton } from "@/components/common/MediaCard";
import type { PosterGridLayout } from "@/hooks/usePosterGrid";
import { theme } from "@/theme";

/**
 * The loading state, shaped like the grid it is standing in for — same
 * columns, same cell width, same gaps, and the results band's own silhouette
 * on top, so nothing shifts when the real content lands.
 */
export function ResultsSkeleton({ grid }: { grid: PosterGridLayout }) {
  const cells = Math.min(12, Math.max(6, grid.columns * 3));
  return (
    <View style={styles.skeletonScreen}>
      {/* Same three stacked blocks as the real band, in the same order, so
          the header does not re-flow when the count lands. */}
      <View style={styles.skeletonHeader}>
        <Skeleton width={68} height={11} radius="sm" />
        <Skeleton width="72%" height={26} radius="sm" />
        <View style={styles.skeletonCountRow}>
          <Skeleton width={148} height={28} radius="pill" />
        </View>
      </View>
      <View style={[styles.skeletonGrid, { gap: grid.gap, rowGap: theme.spacing.lg }]}>
        {Array.from({ length: cells }).map((_, index) => (
          <MediaCardSkeleton key={index} width={grid.cellWidth} metaLines={2} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonScreen: { paddingTop: theme.spacing.md },
  skeletonHeader: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.md, gap: 2 },
  skeletonCountRow: { flexDirection: "row", marginTop: theme.spacing.sm },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
  },
});

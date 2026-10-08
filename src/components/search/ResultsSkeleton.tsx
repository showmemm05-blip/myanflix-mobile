import { StyleSheet, View } from "react-native";
import { Skeleton } from "@/components/common/Skeleton";
import { BookCardSkeleton } from "@/components/books/BookCard";
import { ThemedText } from "@/components/ui/ThemedText";
import { PosterCellSkeleton } from "@/components/search/PosterCell";
import type { SearchGridLayout } from "@/components/search/useSearchGrid";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/** Three rows of the grid — the first screenful on a phone. */
const GRID_SKELETON_ROWS = 3;

/**
 * The count row's silhouette — the count bar on the left and the real number
 * of pills on the right (People always; Filter only where the screen would
 * draw it in this row), so nothing reflows when the header lands.
 */
function HeaderSkeleton({ pills }: { pills: number }) {
  return (
    <View style={styles.header}>
      <Skeleton width={170} height={16} radius="xs" />
      <View style={styles.headerActions}>
        {Array.from({ length: pills }, (_, index) => index).map((index) => (
          <Skeleton key={index} width={index === 0 ? 92 : 84} height={34} radius="pill" />
        ))}
      </View>
    </View>
  );
}

/**
 * The Movies / Series / Books loading state, in the grid's exact shape — same
 * columns, same cell width, same gaps, the count row on top.
 */
export function ResultsSkeleton({
  grid,
  kind,
  pills,
  topPadding,
}: {
  grid: SearchGridLayout;
  kind: "poster" | "book";
  /** How many pills the real count row will carry (1 or 2). */
  pills: number;
  topPadding: number;
}) {
  const cells = grid.columns * GRID_SKELETON_ROWS;
  return (
    <View style={{ paddingTop: topPadding }} accessibilityRole="progressbar">
      <HeaderSkeleton pills={pills} />
      <View style={[styles.grid, { columnGap: grid.gap, rowGap: grid.rowGap }]}>
        {Array.from({ length: cells }, (_, index) => index).map((index) =>
          kind === "book" ? (
            <BookCardSkeleton key={index} width={grid.cellWidth} />
          ) : (
            <PosterCellSkeleton key={index} width={grid.cellWidth} />
          ),
        )}
      </View>
    </View>
  );
}

/** One section of the search screen's idle loading state: its real heading over three cells. */
function SectionSkeleton({ title, grid, kind }: { title: string; grid: SearchGridLayout; kind: "poster" | "book" }) {
  return (
    <View>
      <ThemedText variant="section" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.grid, { columnGap: grid.gap, rowGap: grid.rowGap }]}>
        {Array.from({ length: 3 }, (_, index) => index).map((index) =>
          kind === "book" ? (
            <BookCardSkeleton key={index} width={grid.cellWidth} />
          ) : (
            <PosterCellSkeleton key={index} width={grid.cellWidth} />
          ),
        )}
      </View>
    </View>
  );
}

/**
 * One section of the search screen before a search, while its three titles
 * are on the wire (MediaSearch.dc.html, "loading"): the section's real
 * heading — Popular movies, New series, New on the shelf — over three cells
 * of the right shape, so the loaded section lands exactly where this one was.
 * The screen places it itself: on All / Movies it sits under the trending
 * skeleton and the Browse categories row, which stays live while loading.
 */
export function IdleSkeleton({ grid, title, kind }: { grid: SearchGridLayout; title: string; kind: "poster" | "book" }) {
  const { t } = useLanguage();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
      <SectionSkeleton title={title} grid={grid} kind={kind} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.layout.screenPadding,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    paddingHorizontal: theme.layout.screenPadding,
  },
  sectionTitle: { paddingHorizontal: theme.layout.screenPadding },
});

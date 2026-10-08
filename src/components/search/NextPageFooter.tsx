import { Pressable, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { BookCardSkeleton } from "@/components/books/BookCard";
import { PosterCellSkeleton } from "@/components/search/PosterCell";
import type { SearchGridLayout } from "@/components/search/useSearchGrid";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  grid: SearchGridLayout;
  kind: "poster" | "book";
  /** The next page is on the wire — one row of placeholder cells. */
  loading: boolean;
  /**
   * The automatic next-page load FAILED. Scrolling again would not retry it
   * (the list's end has already been reached), so an inline "Couldn't load
   * more · Retry" line appears — never a "Load more" button: every page
   * arrives by itself as the list nears its end.
   */
  failed: boolean;
  /** Retry: asks for the failed page again. */
  onRetry: () => void;
}

/**
 * The grid's footer: a skeleton row while the next page streams in (the
 * boards forbid spinners), the inline Retry after a failed page, and
 * nothing otherwise.
 */
export function NextPageFooter({ grid, kind, loading, failed, onRetry }: Props) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <View
        style={[styles.row, { columnGap: grid.gap }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t.common.loading}
      >
        {Array.from({ length: grid.columns }, (_, index) => index).map((index) =>
          kind === "book" ? (
            <BookCardSkeleton key={index} width={grid.cellWidth} />
          ) : (
            <PosterCellSkeleton key={index} width={grid.cellWidth} />
          ),
        )}
      </View>
    );
  }
  if (failed) return <NextPageError onRetry={onRetry} />;
  return null;
}

/**
 * A failed next page, inline at the end of a grid: what happened and a
 * Retry, on one line that wraps at a large text size. The pages already
 * loaded stay above it. Shared by the search results and the Media hubs.
 */
export function NextPageError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.error}>
      <View style={styles.errorText} accessible accessibilityLiveRegion="polite">
        <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.danger} />
        <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.errorLine}>
          {t.search.nextPageError}
        </ThemedText>
      </View>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.search.nextPageRetryA11y}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        <Ionicons name="refresh" size={16} color={theme.colors.link} />
        <ThemedText variant="muted" weight="extrabold" color={theme.colors.link}>
          {t.common.retry}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginTop: 20,
    paddingHorizontal: theme.layout.screenPadding,
  },
  error: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.layout.screenPadding,
  },
  errorText: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexShrink: 1 },
  errorLine: { flexShrink: 1 },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: theme.layout.minTouch,
    paddingHorizontal: theme.spacing.sm,
  },
  pressed: { opacity: 0.7 },
});

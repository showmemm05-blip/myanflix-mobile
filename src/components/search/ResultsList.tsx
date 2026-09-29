import { useCallback, type ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
  type ListRenderItemInfo,
  type RefreshControlProps,
} from "react-native";
import { theme } from "@/theme";

/**
 * Module scope on purpose — handed to FlatList, whose cells are PureComponents,
 * so an inline separator would re-render every visible row for a change that
 * only touched the search field above the list. Same rule as ResultsGrid.
 */
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

interface ResultsListProps<T> {
  /** Prefixes the list's `key`, so switching between two lists remounts rather than reconciles. */
  id: string;
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  header: ReactElement | null;
  footer: ReactElement | null;
  /** initialNumToRender / maxToRenderPerBatch — a screenful of rows. */
  batch: number;
  onEndReached: () => void;
  /**
   * Passed through as an ELEMENT, already memoized by the caller: a fresh
   * `<RefreshControl>` per render would force a whole VirtualizedList pass on
   * every keystroke — exactly what the screen's committed-term model prevents.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** `removeClippedSubviews`, straight through — the list cards cast no shadow, so clipping is safe. */
  clip?: boolean;
}

/**
 * The one-per-row results list — the movie and series tabs' list, where
 * ResultsGrid stays the books tab's grid. Same scrolling contract as the grid
 * (dismiss-on-drag, end-reached at 0.6, memoized refresh control) so the two
 * feel identical under the thumb; only the row shape differs.
 *
 * The horizontal inset lives on the ROW wrapper, not on the content container,
 * because the header the screen passes in (recents, the results band) carries
 * its own padding and would otherwise be indented twice.
 */
export function ResultsList<T>({
  id,
  data,
  keyExtractor,
  renderItem,
  header,
  footer,
  batch,
  onEndReached,
  refreshControl,
  clip,
}: ResultsListProps<T>) {
  // useCallback, not an inline arrow: this component is not memoized, so it
  // re-renders with the screen on every keystroke — the wrapper has to keep
  // its identity or FlatList (a PureComponent) would re-render every row.
  const renderRow = useCallback(
    (info: ListRenderItemInfo<T>) => <View style={styles.row}>{renderItem(info)}</View>,
    [renderItem],
  );

  return (
    <FlatList
      key={`${id}-list`}
      data={data}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={RowSeparator}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={renderRow}
      onEndReachedThreshold={0.6}
      onEndReached={onEndReached}
      refreshControl={refreshControl}
      initialNumToRender={batch}
      maxToRenderPerBatch={batch}
      windowSize={5}
      removeClippedSubviews={clip}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: theme.layout.screenPadding },
  rowGap: { height: theme.spacing.sm + 2 },
  content: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.layout.tabBarClearance,
  },
});

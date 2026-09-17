import type { ReactElement } from "react";
import {
  FlatList,
  StyleSheet,
  View,
  type ListRenderItem,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "@/theme";

/**
 * Module scope on purpose. It is handed to FlatList, whose cells are
 * PureComponents — an inline `() => <View/>` separator would be a fresh
 * identity on every render and re-render every visible row for a change that
 * only touched the search field above the list.
 */
function RowSeparator() {
  return <View style={styles.rowGap} />;
}

interface ResultsGridProps<T> {
  /**
   * Prefixes the list's `key`, which is what forces a fresh FlatList when the
   * column count changes — numColumns cannot be changed on the fly.
   */
  id: string;
  data: readonly T[];
  columns: number;
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  header: ReactElement | null;
  footer: ReactElement | null;
  rowStyle: StyleProp<ViewStyle>;
  /** initialNumToRender / maxToRenderPerBatch — roughly three rows. */
  batch: number;
  onEndReached: () => void;
  /**
   * Passed through as an ELEMENT, already memoized by the caller: FlatList is a
   * PureComponent, so a fresh `<RefreshControl>` built here on every render
   * would force a whole VirtualizedList pass per keystroke — exactly what the
   * screen's committed-term model exists to prevent. Omitted where a grid has
   * no pull-to-refresh.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * `removeClippedSubviews`, passed straight through — and LEFT UNDEFINED by
   * the books grid, which is not the same thing as `false`. A book card casts a
   * real drop shadow that falls OUTSIDE its own bounds, and clipping shears it
   * off for cells near the recycling boundary mid-fling; the books rail leaves
   * the flag off for the same reason. Undefined is what that grid has always
   * sent, so it keeps FlatList's own per-platform default
   * (`removeClippedSubviewsOrDefault`) rather than quietly changing on one
   * platform — do not give this a default value here.
   */
  clip?: boolean;
}

/**
 * The one results grid, three callers — movies, series and books. They differ
 * only in their data, their renderer, their key prefix, whether they have
 * pull-to-refresh, and the books grid's documented `clip` exception.
 */
export function ResultsGrid<T>({
  id,
  data,
  columns,
  keyExtractor,
  renderItem,
  header,
  footer,
  rowStyle,
  batch,
  onEndReached,
  refreshControl,
  clip,
}: ResultsGridProps<T>) {
  return (
    <FlatList
      key={`${id}-grid-${columns}`}
      data={data}
      numColumns={columns}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={rowStyle}
      ItemSeparatorComponent={RowSeparator}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={renderItem}
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
  /** Bigger cards need more air between rows than between columns. */
  rowGap: { height: theme.spacing.lg },
  gridContent: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
});

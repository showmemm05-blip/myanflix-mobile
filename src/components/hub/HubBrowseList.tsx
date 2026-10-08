import { useCallback, type ReactElement } from "react";
import { type ListRenderItemInfo } from "react-native";
import Animated from "react-native-reanimated";
import { useHubListScroll, useHubRefreshControl } from "@/components/hub/HubAllGrid";
import type { HubScroll } from "@/components/hub/useHubScroll";
import { useDockClearance } from "@/hooks/useDockClearance";

interface Props<T> {
  /** From useHubScroll(): the list is attached to it (the bar's glass, the hero's pager). */
  scroll: HubScroll;
  /** The hero (or the empty hero) above the rows. */
  header: ReactElement;
  /** One entry per shelf — Trending now, Popular, the genre rows… */
  rows: readonly T[];
  rowKey: (row: T) => string;
  /**
   * One shelf. Memoize it. A shelf renders nothing once it has loaded empty,
   * so it carries its own gap above it (HubRow's `style`).
   */
  renderRow: (row: T, index: number) => ReactElement | null;
  /** Pull-to-refresh: every shelf on screen. */
  onRefresh?: () => void;
  /** A refresh the user pulled for is in flight — never a background refetch. */
  refreshing?: boolean;
}

/**
 * A hub's BROWSE view — the Netflix home of the Movies / Series chip: the
 * hero, then one horizontal shelf per entry, as ONE vertical virtualized
 * list. Shelves are mounted as they near the screen and each asks for its
 * own titles when it mounts, so the page keeps filling in by itself as the
 * user scrolls (genre after genre) without asking for shelves nobody
 * reaches. React Query keeps what came back, so a shelf scrolled away and
 * back is instant.
 */
export function HubBrowseList<T>({ scroll, header, rows, rowKey, renderRow, onRefresh, refreshing = false }: Props<T>) {
  const dockClearance = useDockClearance();
  const refreshControl = useHubRefreshControl(onRefresh, refreshing);
  useHubListScroll(scroll, "browse");

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<T>) => renderRow(item, index), [renderRow]);

  return (
    <Animated.FlatList
      ref={scroll.listRef}
      data={rows}
      keyExtractor={rowKey}
      renderItem={renderItem}
      ListHeaderComponent={header}
      // The hero plus the first few shelves on the first frame; the rest
      // mount (and ask for their titles) as the user scrolls towards them.
      // windowSize 3 = one screen above and one below the visible area, one
      // shelf per batch: 7 mounted about 10 shelves (10 requests) on first
      // open, most of them never seen. Shelves still mount, and fetch, a
      // screen before the user reaches them.
      initialNumToRender={3}
      maxToRenderPerBatch={1}
      windowSize={3}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      contentContainerStyle={{ paddingBottom: dockClearance }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
}

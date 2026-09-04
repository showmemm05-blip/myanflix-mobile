import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export interface PosterGridLayout {
  /** 3 on phones, 4 from 600pt, 5 from 900pt — key FlatLists by this so numColumns changes remount. */
  columns: number;
  /** Horizontal AND vertical gap between cells. */
  gap: number;
  /** Pass as each MediaCard/BookCard's `width`. */
  cellWidth: number;
  /** The grid's horizontal padding — theme.layout.screenPadding. */
  contentPadding: number;
}

/**
 * One shared layout brain for every portrait poster grid (Search results,
 * Favorites, WatchHistory, CategoryDetail, BooksCatalog) so all of them
 * agree on columns and cell width, and rotation/foldables re-flow live.
 */
export function usePosterGrid(): PosterGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const gap = 12;
  const contentPadding = theme.layout.screenPadding;
  const available = width - insets.left - insets.right - 2 * contentPadding - (columns - 1) * gap;
  const cellWidth = Math.floor(available / columns);

  return { columns, gap, cellWidth, contentPadding };
}

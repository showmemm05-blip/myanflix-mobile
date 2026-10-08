import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

/**
 * The Media tab's poster grid — the Marquee boards' 3-column grid with 10pt
 * between columns and 20pt between rows, inside the 16pt screen margins.
 *
 * Its own hook rather than usePosterGrid: that one is shared with other
 * screens and spaces its columns 12/14pt apart, where the Search boards draw
 * 10. A phone always gets three columns (320pt still leaves an 89pt poster);
 * a tablet gets four or five so a poster never grows past a readable size.
 *
 * LAYOUT ONLY. This hook must never fetch, cache or derive data.
 */
export interface SearchGridLayout {
  columns: number;
  /** Between columns. */
  gap: number;
  /** Between rows. */
  rowGap: number;
  cellWidth: number;
}

export const SEARCH_GRID_GAP = 10;
export const SEARCH_GRID_ROW_GAP = 20;

export function useSearchGrid(): SearchGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const track = width - insets.left - insets.right - 2 * theme.layout.screenPadding;
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const cellWidth = Math.floor((track - (columns - 1) * SEARCH_GRID_GAP) / columns);
  // One object per layout, not per render: the screen memoizes its grid
  // header and footer on it, and a fresh object would rebuild them on every
  // keystroke.
  return useMemo(
    () => ({ columns, gap: SEARCH_GRID_GAP, rowGap: SEARCH_GRID_ROW_GAP, cellWidth }),
    [columns, cellWidth],
  );
}

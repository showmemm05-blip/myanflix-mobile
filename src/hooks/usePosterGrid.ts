import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export interface PosterGridLayout {
  /** Key FlatLists by this — RN cannot change `numColumns` in place, the list must remount. */
  columns: number;
  /** Horizontal AND vertical gap between cells. */
  gap: number;
  /** Pass as each MediaCard/BookCard's `width`. */
  cellWidth: number;
  /** The grid's horizontal padding — theme.layout.screenPadding. */
  contentPadding: number;
}

/**
 * How large a cell the grid aims for.
 *
 * "default" is the browse/library density — three columns on a phone, which
 * fits a lot of catalogue on screen at the cost of small artwork. "spacious"
 * is for a grid the user is READING rather than scanning (search results):
 * two columns on a phone, so a poster is roughly twice the area and the
 * title, meta and genre under it are legible at a glance.
 */
export type PosterGridDensity = "default" | "spacious";

/**
 * Widest a spacious cell is allowed to get. Past this a poster stops feeling
 * like a card and starts feeling like a hero, so the ladder below adds a
 * column instead — which is what keeps a landscape phone and a tablet honest
 * without a second set of breakpoints to maintain.
 */
const SPACIOUS_MAX_CELL = 200;
/** Never fold past this, however wide the window gets. */
const SPACIOUS_MAX_COLUMNS = 8;

/**
 * One shared layout brain for every portrait poster grid (Search results,
 * Favorites, WatchHistory, CategoryDetail, BooksCatalog) so all of them
 * agree on columns and cell width, and rotation/foldables re-flow live.
 */
export function usePosterGrid(density: PosterGridDensity = "default"): PosterGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const contentPadding = theme.layout.screenPadding;
  const gap = density === "spacious" ? 14 : 12;
  const track = width - insets.left - insets.right - 2 * contentPadding;
  const measure = (count: number) => Math.floor((track - (count - 1) * gap) / count);

  if (density === "spacious") {
    // Grow from two columns until a cell stops being oversized. Driven by the
    // resulting cell width rather than by window-width breakpoints, so an
    // unusual window (foldable half-screen, split view) still lands on a
    // sensible card instead of an in-between one.
    let columns = 2;
    while (columns < SPACIOUS_MAX_COLUMNS && measure(columns) > SPACIOUS_MAX_CELL) columns += 1;
    return { columns, gap, cellWidth: measure(columns), contentPadding };
  }

  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  return { columns, gap, cellWidth: measure(columns), contentPadding };
}

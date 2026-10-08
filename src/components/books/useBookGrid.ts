import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

export interface BookGridLayout {
  /** Key FlatLists by this — RN cannot change `numColumns` in place. */
  columns: number;
  /** Between cells in a row. */
  columnGap: number;
  /** Between rows. */
  rowGap: number;
  cellWidth: number;
}

/**
 * The hardcover grids' geometry (LAYOUT ONLY — never fetches).
 *
 *  - "shelf" — Books.dc.html's "All books": three covers a row on a phone
 *    (110pt on the 390pt board) 14pt apart, rows 20pt apart; four and five
 *    columns on wider windows, the same ladder as usePosterGrid's default.
 *  - "author" — AuthorDetail.dc.html: two large covers a row (171pt), 16pt
 *    apart, rows 24pt apart, adding a column once a cover would pass 200pt.
 */
export function useBookGrid(kind: "shelf" | "author" = "shelf"): BookGridLayout {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const track = width - insets.left - insets.right - 2 * theme.layout.screenPadding;

  if (kind === "author") {
    const columnGap = 16;
    const measure = (count: number) => Math.floor((track - (count - 1) * columnGap) / count);
    let columns = 2;
    while (columns < 6 && measure(columns) > 200) columns += 1;
    return { columns, columnGap, rowGap: theme.spacing.lg, cellWidth: measure(columns) };
  }

  const columnGap = 14;
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  return {
    columns,
    columnGap,
    rowGap: 20,
    cellWidth: Math.floor((track - (columns - 1) * columnGap) / columns),
  };
}

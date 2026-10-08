import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { useSheetKeyboardLift } from "@/components/ui/BottomSheet";
import { theme } from "@/theme";
import type { BookPage } from "@/types/book";

/** PageReader.dc.html: four thumbs a row, 10pt apart, rows 12pt apart. */
const COLUMNS = 4;
const COLUMN_GAP = 10;
const ROW_GAP = 12;
/** A scanned page's shape — 82 × 117 on the board. */
const PAGE_RATIO = 0.7;
/** The ring around the open page: 2pt of the sheet, then 2pt of crimson — reserved on every thumb so none shifts. */
const RING = 4;
/** The folio line under each thumb. */
const CAPTION = 6 + 18;
/** The sheet's own side padding. */
const SHEET_PADDING = theme.layout.screenPadding;

interface Props {
  pages: BookPage[];
  /** 0-based index of the page being read — ringed and scrolled into view. */
  currentIndex: number;
  /** 0-based page index; the host closes its sheet and jumps. */
  onSelect: (index: number) => void;
}

/**
 * The page-book thumbnail grid — the Pages tab of the contents sheet AND the
 * body of the jump sheet share this one component. A windowed FlatList of
 * expo-image thumbs with folio captions; the open page carries the crimson
 * ring and the grid opens scrolled to its row. Row heights are exact (from
 * the window width), so getItemLayout — and the initial scroll — stay honest.
 */
export function PageThumbGrid({ pages, currentIndex, onSelect }: Props) {
  /**
   * The jump sheet pins its "Go to page" button in the sheet's footer, which
   * rises by this much to clear the keyboard summoned by the page-number field
   * above the grid — and it rises OVER this list, because a footer is lifted by
   * a transform so it never reflows the body. Without the matching reserve the
   * last row of thumbs cannot be scrolled out from behind the button. Zero in
   * the contents sheet, which has no field to raise a keyboard with.
   */
  const keyboardLift = useSheetKeyboardLift();
  const { width } = useWindowDimensions();

  const { thumbHeight, rowHeight } = useMemo(() => {
    const cell = (width - 2 * SHEET_PADDING - (COLUMNS - 1) * COLUMN_GAP) / COLUMNS;
    const thumb = Math.round((cell - 2 * RING) / PAGE_RATIO);
    return { thumbHeight: thumb, rowHeight: thumb + 2 * RING + CAPTION + ROW_GAP };
  }, [width]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookPage>) => {
      const current = index === currentIndex;
      return (
        <Pressable
          onPress={() => onSelect(index)}
          accessibilityRole="button"
          accessibilityLabel={String(item.pageNumber)}
          accessibilityState={{ selected: current }}
          style={({ pressed }) => [styles.cell, { height: rowHeight }, pressed && styles.pressed]}
        >
          <View style={[styles.ring, current && styles.ringCurrent]}>
            <View style={[styles.thumb, { height: thumbHeight }]}>
              <Image
                source={{ uri: item.url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={120}
                recyclingKey={item.url}
                // Page thumbs scroll out of the window and back constantly; the
                // disk-only default re-decodes each time. See MediaCard.
                cachePolicy="memory-disk"
              />
            </View>
          </View>
          <ThemedText
            variant="label"
            weight="bold"
            tabular
            allowFontScaling={false}
            color={current ? theme.colors.link : theme.colors.textMuted}
            style={styles.caption}
          >
            {String(item.pageNumber)}
          </ThemedText>
        </Pressable>
      );
    },
    [currentIndex, onSelect, rowHeight, thumbHeight],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<BookPage> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * Math.floor(index / COLUMNS),
      index,
    }),
    [rowHeight],
  );

  return (
    <FlatList
      data={pages}
      keyExtractor={(page) => String(page.pageNumber)}
      renderItem={renderItem}
      numColumns={COLUMNS}
      getItemLayout={getItemLayout}
      initialScrollIndex={pages.length > 0 ? Math.min(currentIndex, pages.length - 1) : undefined}
      columnWrapperStyle={styles.rowWrap}
      contentContainerStyle={[styles.content, keyboardLift > 0 && { paddingBottom: theme.spacing.lg + keyboardLift }]}
      initialNumToRender={16}
      windowSize={5}
      maxToRenderPerBatch={12}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: theme.spacing.xs, paddingBottom: theme.spacing.lg },
  rowWrap: { gap: COLUMN_GAP },
  cell: { flex: 1, alignItems: "stretch", paddingBottom: ROW_GAP },
  pressed: { opacity: 0.75 },
  ring: { padding: 2, borderWidth: 2, borderColor: "transparent", borderRadius: 8 },
  ringCurrent: { borderColor: theme.colors.primary },
  thumb: {
    borderRadius: theme.radius.xs - 1,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  caption: { marginTop: 6, lineHeight: 18, textAlign: "center", letterSpacing: 0 },
});

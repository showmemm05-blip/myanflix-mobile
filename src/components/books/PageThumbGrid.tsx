import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme, withAlpha } from "@/theme";
import type { BookPage } from "@/types/book";

const COLUMNS = 3;
const THUMB_HEIGHT = 118;
/** Thumb + caption + row gap — getItemLayout's whole contract. */
const ROW_HEIGHT = THUMB_HEIGHT + 22 + theme.spacing.sm;

interface Props {
  pages: BookPage[];
  /** 0-based index of the page being read — ringed and scrolled into view. */
  currentIndex: number;
  /** 0-based page index; the host closes its sheet and jumps. */
  onSelect: (index: number) => void;
}

/**
 * The page-book thumbnail grid — the Pages tab of the contents sheet AND the
 * body of the upgraded jump sheet share this one component. A windowed
 * FlatList of expo-image thumbs with folio captions; the open page carries
 * the primary ring and the grid opens scrolled to its row.
 */
export function PageThumbGrid({ pages, currentIndex, onSelect }: Props) {
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<BookPage>) => {
      const current = index === currentIndex;
      return (
        <Pressable
          onPress={() => onSelect(index)}
          accessibilityRole="button"
          accessibilityLabel={String(item.pageNumber)}
          accessibilityState={{ selected: current }}
          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
        >
          <View style={[styles.thumb, current && styles.thumbCurrent]}>
            <Image
              source={{ uri: item.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
              recyclingKey={item.url}
            />
          </View>
          <ThemedText
            variant="caption"
            tabular
            color={current ? theme.colors.primary : theme.colors.textFaint}
            style={styles.caption}
          >
            {String(item.pageNumber)}
          </ThemedText>
        </Pressable>
      );
    },
    [currentIndex, onSelect],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<BookPage> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * Math.floor(index / COLUMNS),
      index,
    }),
    [],
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
      contentContainerStyle={styles.content}
      initialNumToRender={12}
      windowSize={5}
      maxToRenderPerBatch={9}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.lg },
  rowWrap: { gap: theme.spacing.sm },
  cell: {
    flex: 1,
    height: ROW_HEIGHT,
    paddingBottom: theme.spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  pressed: { opacity: 0.75 },
  thumb: {
    alignSelf: "stretch",
    height: THUMB_HEIGHT,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
    borderWidth: 1,
    borderColor: theme.colors.ring,
  },
  thumbCurrent: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    shadowColor: withAlpha(theme.colors.primary, 0.4),
  },
  caption: { lineHeight: 18 },
});

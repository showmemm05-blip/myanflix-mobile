import { memo, useCallback, type ReactNode } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItem } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { theme } from "@/theme";
import type { Book } from "@/types/book";

/** Books.dc.html: 12pt between covers on a shelf. */
const GAP = 12;
/** The rail's leading content inset — item 0 starts this far in. */
const EDGE = theme.layout.screenPadding;
const SKELETON_COUNT = 4;

/**
 * A shelf cover is 116pt on the 390pt board — about 30% of the width, so
 * three books and the edge of a fourth show, which is what says "scroll me".
 * Clamped on tablets so a cover never turns into a hero.
 */
export function useBookRailCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width * 0.3, 140));
}

interface Props {
  title: string;
  books: Book[];
  onPressBook: (book: Book) => void;
  /** Small quiet line above the title. */
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** Renders placeholder cards instead of hiding the rail while data loads. */
  loading?: boolean;
  /**
   * Replaces the section heading with the caller's own block (the Books
   * screen's category banner). `title` still names nothing visible then, so
   * the caller's header must carry the heading itself.
   */
  header?: ReactNode;
}

const keyExtractor = (book: Book) => book.id;
const Separator = () => <View style={styles.separator} />;

/**
 * One shelf cell. Memoized for the same reason MediaRail's is: the parent is a
 * screen whose state changes on every keystroke, and a stable cell keeps those
 * re-renders from reaching the cards.
 */
const RailCard = memo(function RailCard({
  book,
  width,
  onPress,
}: {
  book: Book;
  width: number;
  onPress: (book: Book) => void;
}) {
  return (
    <BookCard
      width={width}
      title={book.title}
      author={book.author}
      coverUrl={book.coverUrl}
      category={book.categories[0]?.name}
      onPress={() => onPress(book)}
    />
  );
});

/**
 * A horizontally scrolling shelf of BOOKS — the books sibling of MediaRail,
 * not a variant of it (a 5:7 cover is not a 2:3 poster, so card width, snap
 * stride and getItemLayout all differ). The fling copies MediaRail's — snap
 * to the first card, fast deceleration — so it feels the same.
 *
 * Renders nothing when there is nothing to show, so a guest (or a books
 * outage) simply has no shelf rather than an error where a shelf should be.
 */
export function BookRail({ title, books, onPressBook, eyebrow, icon, onSeeAll, seeAllLabel, loading, header }: Props) {
  const cardWidth = useBookRailCardWidth();

  const renderItem = useCallback<ListRenderItem<Book>>(
    ({ item }) => <RailCard book={item} width={cardWidth} onPress={onPressBook} />,
    [cardWidth, onPressBook],
  );

  /**
   * Cells are laid out on a `cardWidth + GAP` stride (the separator sits
   * between them) and the whole row is inset by the content padding, so the
   * frame of item n starts at EDGE + stride * n and is exactly cardWidth long.
   */
  const getItemLayout = useCallback(
    (_: ArrayLike<Book> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: EDGE + (cardWidth + GAP) * index,
      index,
    }),
    [cardWidth],
  );

  if (!loading && books.length === 0) return null;

  return (
    <View>
      {header ?? (
        <SectionHeader
          title={title}
          eyebrow={eyebrow}
          icon={icon}
          onSeeAll={onSeeAll}
          seeAllLabel={seeAllLabel}
          // Books.dc.html / BookDetail.dc.html draw "See all" in the quiet grey.
          seeAllTone="muted"
        />
      )}

      {loading && books.length === 0 ? (
        <View style={styles.skeletonRow}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <BookCardSkeleton key={index} width={cardWidth} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={books}
          keyExtractor={keyExtractor}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
          snapToInterval={cardWidth + GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          initialNumToRender={4}
          maxToRenderPerBatch={6}
          windowSize={5}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: EDGE },
  skeletonRow: { flexDirection: "row", gap: GAP, paddingHorizontal: EDGE, overflow: "hidden" },
  separator: { width: GAP },
});

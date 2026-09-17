import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions, type ListRenderItem } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { theme } from "@/theme";
import type { Book } from "@/types/book";

/** Same stride gap MediaRail uses, so card edges line up down the scroll. */
const GAP = 12;
/** The rail's leading content inset — item 0 starts this far in. */
const EDGE = theme.layout.screenPadding;
const SKELETON_COUNT = 4;

/**
 * Books sit NARROWER than the poster rails above them. A 5:7 cover at the same
 * width as a 2:3 poster is visibly shorter, so the web makes its book cards
 * ~0.9 of its movie cards; this is MediaCard's `useRailCardWidth` (36% / 160)
 * with that same factor applied. The practical effect is about three books
 * peeking where two-and-a-bit posters do, which is what a shelf should look like.
 */
function useBookRailCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width * 0.32, 140));
}

interface Props {
  title: string;
  books: Book[];
  onPressBook: (book: Book) => void;
  /** Small uppercase line above the title — the medium, as on the web. */
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** Renders placeholder cards instead of hiding the rail while data loads. */
  loading?: boolean;
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
 * not a variant of it.
 *
 * MediaRail is poster-shaped at every level: its item type is built from
 * MediaCardProps, its cells and skeletons are MediaCards, and its card width,
 * snap stride and getItemLayout are all measured for a 2:3 poster. It is also
 * shared with Home and the detail screens, so widening it with a renderItem
 * escape hatch would be a refactor far larger than this shelf. This follows
 * the rule the web's own MediaRail states: the shelf is common, the objects on
 * it are not. Everything about the scrolling — snap interval, deceleration,
 * batch sizes — is copied from MediaRail deliberately, so the fling feels the
 * same as the rails above it.
 *
 * Renders nothing when there is nothing to show, which doubles as the web's
 * `books.length > 0 &&` guard: a guest (or a books outage) simply has no shelf
 * rather than an error where a shelf should be.
 */
export function BookRail({ title, books, onPressBook, eyebrow, icon, onSeeAll, seeAllLabel, loading }: Props) {
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
    <View style={styles.container}>
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        icon={icon}
        onSeeAll={onSeeAll}
        seeAllLabel={seeAllLabel}
      />

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
  container: { gap: theme.spacing.xs },
  // The vertical padding is not cosmetic: the cards now cast a real drop
  // shadow, and a contentContainer sized exactly to the card would crop it.
  listContent: { paddingHorizontal: EDGE, paddingTop: 2, paddingBottom: theme.spacing.sm },
  skeletonRow: { flexDirection: "row", gap: GAP, paddingHorizontal: EDGE, overflow: "hidden" },
  separator: { width: GAP },
});

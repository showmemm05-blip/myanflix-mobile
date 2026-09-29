import { useCallback, useMemo } from "react";
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/common/Skeleton";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { ResultsGrid } from "@/components/search/ResultsGrid";
import { useBookAuthor } from "@/hooks/useBookAuthors";
import { useBooksInfinite } from "@/hooks/useBooks";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Book } from "@/types/book";

type Props = NativeStackScreenProps<SearchStackParamList, "AuthorDetails">;

/** The round photo at the top of the page — the actor page's 96. */
const PHOTO_SIZE = 96;

/** Module scope — handed to FlatList, whose cells are PureComponents (see ResultsGrid). */
const keyExtractor = (book: Book) => book.id;

/**
 * An author's page: their photo, their name, how many books, their blurb when
 * the catalogue has one, and everything they wrote as the same hardcover grid
 * the Books tab draws — paged from `GET /books?authorId=…`, which is an exact
 * match on the book's own author column.
 *
 * The twin of ActorDetails, with ONE addition: actors carry no bio, authors do,
 * so the blurb sits under the count in the page's own type (a `body` paragraph,
 * centred like the rest of the hero) rather than in a component of its own.
 *
 * TWO NUMBERS, ONE TRUTH. The author row's `bookCount` counts every book they
 * wrote; `GET /books` only ever returns what THIS viewer may see (published
 * editions). So the caption prefers the catalogue's own total once it lands and
 * falls back to the row's count until then — and an author with an unpublished
 * shelf legitimately shows the empty state under a non-zero fallback.
 */
export function AuthorDetailsScreen({ route, navigation }: Props) {
  const { authorId } = route.params;
  const { t } = useLanguage();
  // Spacious, like the books tab: a shelf is READ, not scanned.
  const grid = usePosterGrid("spacious");
  const authorQuery = useBookAuthor(authorId);
  const booksQuery = useBooksInfinite({ authorId, limit: LIST_PAGE_SIZE });
  const books = useMemo(() => flattenPages(booksQuery.data?.pages), [booksQuery.data]);
  const author = authorQuery.data;

  const bookTotal = booksQuery.data?.pages[0]?.total ?? author?.bookCount;
  const countLabel =
    bookTotal === undefined
      ? null
      : bookTotal === 1
        ? t.authors.booksCountOne
        : t.authors.booksCount.replace("{n}", String(bookTotal));

  // Stable, so the memoized book cells survive a page landing.
  const goToBookDetails = useCallback(
    (book: Book) => navigation.navigate("BookDetails", { bookId: book.id }),
    [navigation],
  );
  /** The books tab's own card, called exactly the way that grid calls it. */
  const renderBookItem = useCallback(
    ({ item }: ListRenderItemInfo<Book>) => (
      <BookCard
        title={item.title}
        author={item.author}
        coverUrl={item.coverUrl}
        category={item.categories[0]?.name}
        width={grid.cellWidth}
        onPress={() => goToBookDetails(item)}
      />
    ),
    [grid.cellWidth, goToBookDetails],
  );
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  /**
   * FlatList compares these by identity (PureComponent), so each is built once
   * per change of what it reads — never inline. query-core binds `refetch` and
   * `fetchNextPage` in the observer constructor, so they hold.
   */
  const booksEndReached = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) booksQuery.fetchNextPage();
  }, [booksQuery.hasNextPage, booksQuery.isFetchingNextPage, booksQuery.fetchNextPage]);
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={booksQuery.isRefetching && !booksQuery.isFetchingNextPage}
        onRefresh={() => booksQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [booksQuery.isRefetching, booksQuery.isFetchingNextPage, booksQuery.refetch],
  );
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={booksQuery.isFetchingNextPage} />,
    [booksQuery.isFetchingNextPage],
  );

  /** The hero — photo, name, count, blurb — as the grid's header so it scrolls away with the covers. */
  const hero = useMemo(
    () =>
      author ? (
        <View style={styles.hero}>
          <ActorAvatar name={author.name} imageUrl={author.imageUrl} size={PHOTO_SIZE} />
          <ThemedText variant="title" numberOfLines={2} style={styles.center}>
            {author.name}
          </ThemedText>
          {countLabel && (
            <ThemedText variant="caption" tabular>
              {countLabel}
            </ThemedText>
          )}
          {/* Trimmed before the check, so an author whose bio is a stray space
              gets no empty gap where a paragraph would be. */}
          {author.bio?.trim() ? (
            <ThemedText variant="body" style={styles.bio}>
              {author.bio.trim()}
            </ThemedText>
          ) : null}
        </View>
      ) : null,
    [author, countLabel],
  );

  const isLoading = authorQuery.isLoading || booksQuery.isLoading;
  const isError = authorQuery.isError || booksQuery.isError;

  return (
    <View style={styles.container}>
      <TopBar onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      {isLoading ? (
        // The hero's silhouette over book cells at the grid's own cell width
        // and gaps, so nothing moves when the page lands.
        <View style={styles.skeletonContent}>
          <View style={styles.hero}>
            <Skeleton width={PHOTO_SIZE} height={PHOTO_SIZE} radius="pill" />
            <Skeleton width={160} height={22} radius="sm" />
            <Skeleton width={72} height={13} radius="sm" />
          </View>
          <View style={[styles.skeletonGrid, { gap: grid.gap, rowGap: theme.spacing.lg }]}>
            {Array.from({ length: Math.max(4, grid.columns * 2) }).map((_, index) => (
              <BookCardSkeleton key={index} width={grid.cellWidth} />
            ))}
          </View>
        </View>
      ) : isError ? (
        <EmptyState
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => {
            if (authorQuery.isError) authorQuery.refetch();
            if (booksQuery.isError) booksQuery.refetch();
          }}
        />
      ) : books.length === 0 ? (
        <View style={styles.emptyContent}>
          {hero}
          <EmptyState message={t.authors.noBooks} icon="book-outline" fill={false} />
        </View>
      ) : (
        /* No `clip`, unlike the actor page's poster grid: a book card casts a
           real drop shadow that falls OUTSIDE its own bounds, and Android's
           subview clipping shears it off for cells near the recycling boundary
           mid-fling. The books tab and the books rail leave it off too. */
        <ResultsGrid
          id="author-books"
          data={books}
          columns={grid.columns}
          keyExtractor={keyExtractor}
          header={hero}
          footer={listFooter}
          rowStyle={gridRowStyle}
          renderItem={renderBookItem}
          onEndReached={booksEndReached}
          refreshControl={refreshControl}
          batch={grid.columns * 3}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hero: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  center: { textAlign: "center" },
  /** Centred like the name above it, but ragged-centre prose, not a heading. */
  bio: { textAlign: "center", color: theme.colors.textMuted },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  skeletonContent: { paddingTop: theme.spacing.md },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
  },
  emptyContent: { paddingTop: theme.spacing.md, gap: theme.spacing.md },
});

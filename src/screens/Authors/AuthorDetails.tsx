import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassScrollFeed, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { Skeleton } from "@/components/common/Skeleton";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { AuthorPortrait, authorTone } from "@/components/books/AuthorPortrait";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { ExpandableText } from "@/components/books/ExpandableText";
import { useBookGrid } from "@/components/books/useBookGrid";
import { useBookAuthor } from "@/hooks/useBookAuthors";
import { useBooksInfinite } from "@/hooks/useBooks";
import { useDockClearance } from "@/hooks/useDockClearance";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Book } from "@/types/book";

type Props = NativeStackScreenProps<SearchStackParamList, "AuthorDetails">;

/** AuthorDetail.dc.html: a 300pt band, and a 112pt portrait overlapping its foot by half. */
const BAND_HEIGHT = 300;
const PORTRAIT = 112;

const TOP_SCRIM = [withAlpha(theme.colors.background, 0.7), withAlpha(theme.colors.background, 0)] as const;
const FOOT_SCRIM = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.8),
  theme.colors.background,
] as const;

/** Module scope — handed to FlatList, whose cells are PureComponents. */
const keyExtractor = (book: Book) => book.id;

/**
 * An author's page (AuthorDetail.dc.html): a band of art, their portrait,
 * name, how many books, their bio when the catalogue has one (clamped, with
 * More / Less), and everything they wrote as a two-up grid of large covers —
 * paged from `GET /books?authorId=…`, an exact match on the book's own author
 * column.
 *
 * The API has no author banner, so the band borrows the author's newest book
 * cover (GET /books answers newest-first), blurred; with no cover it is the
 * author's own tint.
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
  const insets = useSafeAreaInsets();
  const dockClearance = useDockClearance();
  const grid = useBookGrid("author");
  // The glass bar (components/layout/GlassBar): the back button floats over
  // the band, transparent at the top, frosted once the page scrolls under it
  // — it replaces the solid ground that used to fade in there.
  const glass = useGlassBar();
  const listRef = useAnimatedRef<FlatList<Book>>();
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
  const renderBookItem = useCallback(
    ({ item }: ListRenderItemInfo<Book>) => (
      <BookCard
        title={item.title}
        author={item.author}
        coverUrl={item.coverUrl}
        category={item.categories[0]?.name}
        showAuthor={false}
        coverSize="lg"
        width={grid.cellWidth}
        onPress={() => goToBookDetails(item)}
      />
    ),
    [grid.cellWidth, goToBookDetails],
  );
  const gridRowStyle = useMemo(
    () => [styles.gridRow, { columnGap: grid.columnGap }],
    [grid.columnGap],
  );
  const rowSeparator = useMemo(() => {
    const Separator = () => <View style={{ height: grid.rowGap }} />;
    return Separator;
  }, [grid.rowGap]);

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
        progressViewOffset={glass.barHeight}
      />
    ),
    [booksQuery.isRefetching, booksQuery.isFetchingNextPage, booksQuery.refetch, glass.barHeight],
  );
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={booksQuery.isFetchingNextPage} />,
    [booksQuery.isFetchingNextPage],
  );

  /** The newest book's cover — the band's art. */
  const bandCover = books.find((book) => !!book.coverUrl)?.coverUrl ?? null;

  /** The hero — band, portrait, name, count, bio, then the "Books" heading — scrolling away with the covers. */
  const hero = useMemo(
    () =>
      author ? (
        <View>
          <View style={[styles.band, { backgroundColor: authorTone(author.id).fill }]}>
            {bandCover ? (
              <FadeInView style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: bandCover }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  blurRadius={24}
                  cachePolicy="memory-disk"
                />
              </FadeInView>
            ) : null}
            <LinearGradient colors={TOP_SCRIM} style={[styles.topScrim, { height: insets.top + 120 }]} />
            <LinearGradient colors={FOOT_SCRIM} locations={[0, 0.6, 1]} style={styles.footScrim} />
          </View>
          <FadeInView from="bottom" delay={80} style={styles.portrait}>
            <AuthorPortrait id={author.id} name={author.name} imageUrl={author.imageUrl} size={PORTRAIT} ring />
          </FadeInView>
          <View style={styles.identity}>
            <ThemedText variant="display" accessibilityRole="header">
              {author.name}
            </ThemedText>
            {countLabel && (
              <ThemedText variant="caption" weight="semibold" tabular style={styles.count}>
                {countLabel}
              </ThemedText>
            )}
            {/* Trimmed before the check, so an author whose bio is a stray space
                gets no empty gap where a paragraph would be. */}
            {author.bio?.trim() ? (
              <View style={styles.bio}>
                <ExpandableText text={author.bio.trim()} />
              </View>
            ) : null}
          </View>
          {books.length > 0 && (
            <ThemedText variant="section" accessibilityRole="header" style={styles.booksHeading}>
              {t.books.title}
            </ThemedText>
          )}
        </View>
      ) : null,
    [author, countLabel, bandCover, books.length, insets.top, t],
  );

  const isLoading = authorQuery.isLoading || booksQuery.isLoading;
  const isError = authorQuery.isError || booksQuery.isError;

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {isLoading ? (
          // The hero's silhouette over book cells at the grid's own cell width
          // and gaps, so nothing moves when the page lands.
          <View accessibilityLabel={t.common.loading}>
            <View style={[styles.band, styles.skeletonBand]} />
            <View style={styles.portrait}>
              <Skeleton width={PORTRAIT} height={PORTRAIT} radius="pill" />
            </View>
            <View style={styles.identity}>
              <Skeleton width={200} height={32} radius="sm" />
              <Skeleton width={72} height={13} radius="xs" style={styles.count} />
            </View>
            <View style={[styles.skeletonGrid, { columnGap: grid.columnGap, rowGap: grid.rowGap }]}>
              {Array.from({ length: grid.columns * 2 }).map((_, index) => (
                <BookCardSkeleton key={index} width={grid.cellWidth} coverSize="lg" lines={1} />
              ))}
            </View>
          </View>
        ) : isError ? (
          <EmptyState
            title={t.common.somethingWentWrong}
            message={t.books.loadError}
            icon="cloud-offline-outline"
            tone={theme.colors.danger}
            actionLabel={t.common.retry}
            onAction={() => {
              if (authorQuery.isError) authorQuery.refetch();
              if (booksQuery.isError) booksQuery.refetch();
            }}
          />
        ) : (
          <>
            <FlatList
              ref={listRef}
              // RN cannot change `numColumns` in place — remount when a rotation re-flows the grid.
              key={`author-books-${grid.columns}`}
              data={books}
              numColumns={grid.columns}
              keyExtractor={keyExtractor}
              renderItem={renderBookItem}
              ListHeaderComponent={hero}
              ListEmptyComponent={<EmptyState message={t.authors.noBooks} icon="book-outline" fill={false} style={styles.empty} />}
              ListFooterComponent={listFooter}
              columnWrapperStyle={gridRowStyle}
              ItemSeparatorComponent={rowSeparator}
              contentContainerStyle={{ paddingBottom: dockClearance }}
              onEndReachedThreshold={0.6}
              onEndReached={booksEndReached}
              refreshControl={refreshControl}
              scrollEventThrottle={16}
              initialNumToRender={grid.columns * 3}
              maxToRenderPerBatch={grid.columns * 3}
              windowSize={5}
              showsVerticalScrollIndicator={false}
            />
            <GlassScrollFeed scrollRef={listRef} scrollY={glass.scrollY} />
          </>
        )}
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        transparent
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  band: { height: BAND_HEIGHT, overflow: "hidden" },
  skeletonBand: { backgroundColor: theme.colors.surface },
  topScrim: { position: "absolute", left: 0, right: 0, top: 0 },
  footScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 170 },
  portrait: {
    marginTop: -PORTRAIT / 2,
    marginLeft: theme.layout.screenPadding,
    alignSelf: "flex-start",
  },
  identity: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.md },
  count: { marginTop: theme.spacing.xs },
  bio: { marginTop: theme.spacing.md },
  booksHeading: {
    marginTop: 36,
    marginBottom: 14,
    paddingHorizontal: theme.layout.screenPadding,
  },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.layout.screenPadding,
    marginTop: 48,
  },
  empty: { paddingTop: 48 },
});

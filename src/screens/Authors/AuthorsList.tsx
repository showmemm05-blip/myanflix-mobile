import { useCallback, useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { SearchField } from "@/components/ui/SearchField";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import {
  GLASS_BAR_ROW,
  GlassBarBackground,
  GlassScrollFeed,
  GlassTarget,
  useGlassBar,
} from "@/components/layout/GlassBar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { Skeleton } from "@/components/common/Skeleton";
import { AuthorTile, AuthorTileSkeleton, useAuthorGrid } from "@/components/books/AuthorTile";
import { useBookAuthorsInfinite } from "@/hooks/useBookAuthors";
import { useDockClearance } from "@/hooks/useDockClearance";
import { flattenPages } from "@/hooks/pagination";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { BookAuthorListItem } from "@/api/bookAuthors.api";

type Props = NativeStackScreenProps<SearchStackParamList, "AuthorsList">;

/** Module scope: FlatList cells are PureComponents, so this must not be an inline arrow. */
const keyExtractor = (item: BookAuthorListItem) => item.id;

/**
 * The bar's height under the inset before it is measured: the control row,
 * the large title (8 + 40 + 8) and the search block (8 + 48 + 8).
 */
const BAR_ROWS_ESTIMATE = GLASS_BAR_ROW + 56 + 64;

/**
 * Every author in the catalogue (Authors.dc.html) — reached from the Search
 * Books tab's "Authors" pill and, since Marquee, from the Books screen.
 *
 * Alphabetical (GET /book-authors has no other order), filtered by the same
 * debounced field the actors list uses (useSearchTerm), paged endlessly, with
 * a count line over a grid of portrait tiles: the author's photo when the
 * catalogue has one, otherwise their tinted initials, with the name and book
 * count set on the tile. Same states as before — loading, error + Retry, no
 * match + Clear search, and the empty catalogue.
 */
export function AuthorsListScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = useAuthorGrid();
  const dockClearance = useDockClearance();
  // The glass bar (components/layout/GlassBar): the title and the search field
  // float over the grid, transparent at the top, frosted once tiles scroll
  // under them.
  const glass = useGlassBar(BAR_ROWS_ESTIMATE);
  const listRef = useAnimatedRef<FlatList<BookAuthorListItem>>();
  const { term: searchText, setTerm: setSearchText, effectiveTerm, clear: clearSearch } = useSearchTerm();

  // No minimum-length gate of its own (see useBookAuthorsInfinite): an empty
  // term is this screen's resting state — everyone, alphabetically.
  const authorsQuery = useBookAuthorsInfinite(effectiveTerm);
  const authors = useMemo(() => flattenPages(authorsQuery.data?.pages), [authorsQuery.data]);
  const total = authorsQuery.data?.pages[0]?.total;

  /**
   * The count caption over the grid — its own pair, not the catalogue's
   * "{n} results": an author is not a result. Null while the number in hand
   * describes the PREVIOUS term (keepPreviousData holds the last portraits on
   * screen), so a stale count is never printed over them.
   */
  const countLabel = useMemo(() => {
    if (total === undefined || authorsQuery.isPlaceholderData) return null;
    const n = String(total);
    if (effectiveTerm) {
      const template = total === 1 ? t.search.countAuthorsForTermOne : t.search.countAuthorsForTerm;
      return template.replace("{n}", n).replace("{term}", effectiveTerm);
    }
    return total === 1 ? t.search.countAuthorsOne : t.search.countAuthors.replace("{n}", n);
  }, [total, authorsQuery.isPlaceholderData, effectiveTerm, t]);

  const goToAuthor = useCallback(
    (author: BookAuthorListItem) => navigation.navigate("AuthorDetails", { authorId: author.id }),
    [navigation],
  );

  const cellWidth = grid.cellWidth;
  /**
   * One tile. `bookCount` is the backend's join count, already on every row,
   * so a tile costs no extra request; its words are the author page's own
   * `authors.booksCount` pair, so the number reads the same in both places.
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BookAuthorListItem>) => (
      <AuthorTile
        id={item.id}
        name={item.name}
        imageUrl={item.imageUrl}
        countLabel={
          item.bookCount === 1 ? t.authors.booksCountOne : t.authors.booksCount.replace("{n}", String(item.bookCount))
        }
        width={cellWidth}
        onPress={() => goToAuthor(item)}
      />
    ),
    [cellWidth, goToAuthor, t],
  );

  /** The count line, as the list's header, so it scrolls with the tiles. Fixed height: the grid never jumps. */
  const listHeader = useMemo(
    () => (
      <View style={styles.countRow}>
        {countLabel ? (
          <ThemedText
            variant="caption"
            tabular
            color={theme.colors.textFaint}
            numberOfLines={2}
            accessibilityLiveRegion="polite"
          >
            {countLabel}
          </ThemedText>
        ) : authorsQuery.isFetching ? (
          <Skeleton width={110} height={12} radius="xs" />
        ) : null}
      </View>
    ),
    [countLabel, authorsQuery.isFetching],
  );
  /**
   * FlatList compares `ListFooterComponent` by identity, so the element only
   * moves when the pulse should appear or go.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={authorsQuery.isFetchingNextPage} />,
    [authorsQuery.isFetchingNextPage],
  );
  /** The gap is the grid's — the row wrapper has to agree with the tile width it was measured from. */
  const rowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);
  const rowSeparator = useMemo(() => {
    const Separator = () => <View style={{ height: grid.gap }} />;
    return Separator;
  }, [grid.gap]);

  // Every state starts under the floating bar; the grid scrolls up beneath it.
  const underBar = { paddingTop: glass.barHeight };

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {authorsQuery.isLoading ? (
          <View style={[styles.skeleton, underBar]} accessibilityLabel={t.common.loading}>
            <View style={styles.countRow}>
              <Skeleton width={110} height={12} radius="xs" />
            </View>
            <View style={[styles.skeletonGrid, { gap: grid.gap }]}>
              {Array.from({ length: grid.columns * 3 }).map((_, index) => (
                <AuthorTileSkeleton key={index} width={cellWidth} />
              ))}
            </View>
          </View>
        ) : authorsQuery.isError ? (
          <View style={[styles.flex, underBar]}>
            <EmptyState
              title={t.search.errorTitle}
              message={t.common.somethingWentWrong}
              icon="cloud-offline-outline"
              tone={theme.colors.danger}
              actionLabel={t.common.retry}
              onAction={() => authorsQuery.refetch()}
            />
          </View>
        ) : authors.length === 0 ? (
          /* Two different facts, two different sentences. With a term the
             catalogue simply has nobody by that name, and the way out is to drop
             the term. Without one the screen is empty because the shelf is,
             which no action of the user's can fix, so that one offers none. */
          <View style={[styles.flex, underBar]}>
            {effectiveTerm ? (
              <EmptyState
                title={t.search.noResultsTitle}
                message={t.search.noAuthorsBody.replace("{term}", effectiveTerm)}
                icon="search-outline"
                actionLabel={t.search.clearField}
                onAction={clearSearch}
              />
            ) : (
              <EmptyState title={t.search.authorsEmptyTitle} message={t.search.authorsEmptyBody} icon="create-outline" />
            )}
          </View>
        ) : (
          <FadeInView style={styles.flex}>
            <FlatList
              ref={listRef}
              // RN cannot change `numColumns` in place — the list has to remount
              // when a rotation re-flows the grid.
              key={`authors-grid-${grid.columns}`}
              data={authors}
              numColumns={grid.columns}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ paddingTop: glass.barHeight, paddingBottom: dockClearance }}
              columnWrapperStyle={rowStyle}
              ItemSeparatorComponent={rowSeparator}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              onEndReachedThreshold={0.6}
              onEndReached={() => {
                if (authorsQuery.hasNextPage && !authorsQuery.isFetchingNextPage) authorsQuery.fetchNextPage();
              }}
              refreshControl={
                <RefreshControl
                  refreshing={authorsQuery.isRefetching && !authorsQuery.isFetchingNextPage}
                  onRefresh={() => authorsQuery.refetch()}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                  progressViewOffset={glass.barHeight}
                />
              }
              initialNumToRender={grid.columns * 3}
              maxToRenderPerBatch={grid.columns * 3}
              windowSize={5}
              scrollEventThrottle={16}
            />
            <GlassScrollFeed scrollRef={listRef} scrollY={glass.scrollY} />
          </FadeInView>
        )}
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        title={t.search.authors}
        large
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      >
        <View style={styles.headerBlock} pointerEvents="box-none">
          <SearchField
            value={searchText}
            onChangeText={setSearchText}
            // The grid already follows the field as it settles; Return just
            // puts the keyboard away (the field blurs itself).
            onSubmit={() => {}}
            onClear={clearSearch}
            placeholder={t.search.placeholderAuthors}
            accessibilityLabel={t.authors.searchLabel}
            clearAccessibilityLabel={t.common.clear}
          />
        </View>
      </TopBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  /** 8pt of glass under the field, like the people list (and Media's chips). */
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm },
  /**
   * Keeps its height whether or not the count is known, so the grid never jumps.
   * 8pt down from the bar, whose 8pt under the field makes the same 16 as ever.
   */
  countRow: {
    minHeight: 18,
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
    marginTop: theme.spacing.sm,
    marginBottom: 14,
  },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  skeleton: { flex: 1 },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: theme.layout.screenPadding },
});

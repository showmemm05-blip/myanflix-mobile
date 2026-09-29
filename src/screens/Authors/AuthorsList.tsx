import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { TopBar } from "@/components/layout/TopBar";
import { ActorAvatar } from "@/components/common/ActorAvatar";
import { ListFooterSpinner } from "@/components/common/ListFooterSpinner";
import { ActorGridSkeleton } from "@/components/actors/ActorGridSkeleton";
import { useBookAuthorsInfinite } from "@/hooks/useBookAuthors";
import { flattenPages } from "@/hooks/pagination";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { BookAuthorListItem } from "@/api/bookAuthors.api";

type Props = NativeStackScreenProps<SearchStackParamList, "AuthorsList">;

/** The portrait diameter — the actors list's 72, so the two grids match exactly. */
const PERSON_AVATAR_SIZE = 72;

function RowSeparator() {
  return <View style={styles.rowGap} />;
}
/** Module scope: FlatList cells are PureComponents, so this must not be an inline arrow. */
const keyExtractor = (item: BookAuthorListItem) => item.id;

/**
 * Every author in the catalogue — the BOOKS twin of ActorsList, reached from
 * the same results-header pill, which says "People" on Movies and Series and
 * "Authors" on Books because a book has an author, not a cast.
 *
 * Deliberately the same screen down to the numbers: same TopBar, same debounced
 * field (useSearchTerm), same three-column grid of round portraits, same count
 * caption, skeleton, footer spinner, pull-to-refresh and the same two empties.
 * Anything that changes about one of the two lists should change about both.
 */
export function AuthorsListScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // "default" is the three-column browse density — a 72pt disc with a name and
  // a book count under it wants a third of the width.
  const grid = usePosterGrid();
  const {
    term: searchText,
    setTerm: setSearchText,
    effectiveTerm,
    isDebouncing,
    clear: clearSearch,
  } = useSearchTerm();

  // No minimum-length gate of its own (see useBookAuthorsInfinite): an empty
  // term is this screen's resting state — everyone, alphabetically.
  const authorsQuery = useBookAuthorsInfinite(effectiveTerm);
  const authors = useMemo(() => flattenPages(authorsQuery.data?.pages), [authorsQuery.data]);
  const isSearching = isDebouncing || authorsQuery.isFetching;
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
   * One cell: the round portrait ActorAvatar draws for any person, the name
   * under it, and the author's book count as a caption — the author page's own
   * `authors.booksCount` pair, so the number is worded identically in both
   * places. `bookCount` is the backend's join count, already on every row, so
   * a cell costs no extra request.
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BookAuthorListItem>) => (
      <PressableScale
        onPress={() => goToAuthor(item)}
        accessibilityLabel={item.name}
        style={[styles.personCell, { width: cellWidth }]}
      >
        <ActorAvatar name={item.name} imageUrl={item.imageUrl} size={PERSON_AVATAR_SIZE} />
        <ThemedText
          variant="caption"
          weight="medium"
          color={theme.colors.text}
          numberOfLines={2}
          style={styles.personName}
        >
          {item.name}
        </ThemedText>
        <ThemedText variant="caption" numberOfLines={1} tabular style={styles.personCount}>
          {item.bookCount === 1
            ? t.authors.booksCountOne
            : t.authors.booksCount.replace("{n}", String(item.bookCount))}
        </ThemedText>
      </PressableScale>
    ),
    [cellWidth, goToAuthor, t],
  );

  /** The count line, as the list's header, so it scrolls with the portraits. */
  const listHeader = useMemo(
    () => (
      <View style={styles.countRow}>
        <ThemedText variant="caption" numberOfLines={1}>
          {countLabel ?? ""}
        </ThemedText>
      </View>
    ),
    [countLabel],
  );
  /**
   * FlatList compares `ListFooterComponent` by identity, so the element only
   * moves when the spinner should appear or go.
   */
  const listFooter = useMemo(
    () => <ListFooterSpinner visible={authorsQuery.isFetchingNextPage} />,
    [authorsQuery.isFetchingNextPage],
  );
  /** The gap is the grid's, not a constant — the row wrapper has to agree with
      the cell width it was measured from. */
  const rowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);

  return (
    <View style={styles.container}>
      <TopBar title={t.search.authors} large onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back}>
        <View style={styles.headerBlock}>
          <View style={styles.searchBar}>
            {/* Leading glyph doubles as the progress indicator — same idiom as
                the actors list and the Media screen's own field. */}
            <View style={styles.searchGlyph}>
              {isSearching ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="search" size={18} color={theme.colors.textFaint} />
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.search.placeholderAuthors}
              placeholderTextColor={theme.colors.textFaint}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchText.length > 0 && (
              <PressableScale onPress={clearSearch} style={styles.clearButton} accessibilityLabel={t.common.clear}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
              </PressableScale>
            )}
          </View>
        </View>
      </TopBar>

      {authorsQuery.isLoading ? (
        <ActorGridSkeleton grid={grid} avatar={PERSON_AVATAR_SIZE} />
      ) : authorsQuery.isError ? (
        <EmptyState
          title={t.search.errorTitle}
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => authorsQuery.refetch()}
        />
      ) : authors.length === 0 ? (
        /* Two different facts, two different sentences. With a term the
           catalogue simply has nobody by that name, and the way out is to drop
           the term. Without one the screen is empty because the shelf is,
           which no action of the user's can fix, so that one offers none. */
        effectiveTerm ? (
          <EmptyState
            title={t.search.noResultsTitle}
            message={t.search.noAuthorsBody.replace("{term}", effectiveTerm)}
            icon="search-outline"
            actionLabel={t.search.clearField}
            onAction={clearSearch}
          />
        ) : (
          <EmptyState title={t.search.authorsEmptyTitle} message={t.search.authorsEmptyBody} icon="create-outline" />
        )
      ) : (
        <FlatList
          // RN cannot change `numColumns` in place — the list has to remount
          // when a rotation re-flows the grid.
          key={`authors-grid-${grid.columns}`}
          data={authors}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={rowStyle}
          ItemSeparatorComponent={RowSeparator}
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
            />
          }
          initialNumToRender={grid.columns * 4}
          maxToRenderPerBatch={grid.columns * 4}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: theme.font.regular,
  },
  searchGlyph: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  clearButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  rowGap: { height: theme.spacing.lg },
  /** Keeps its height whether or not the count is known, so the grid never jumps. */
  countRow: {
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xs,
  },
  gridContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  personCell: { alignItems: "center", gap: theme.spacing.xs },
  personName: { textAlign: "center", fontSize: 12, lineHeight: 16 },
  personCount: { textAlign: "center", color: theme.colors.textMuted, fontSize: 11 },
});

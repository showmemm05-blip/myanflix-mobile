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
import { TopBar } from "@/components/layout/TopBar";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { useBooksInfinite } from "@/hooks/useBooks";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useSearchTerm } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Book } from "@/types/book";

type Props = NativeStackScreenProps<SearchStackParamList, "BooksCatalog">;

const PAGE_SIZE = 30;

function RowSeparator() {
  return <View style={styles.rowGap} />;
}
const keyExtractor = (item: Book) => item.id;

/** The digital library — an endless-scroll cover grid with its own search field. */
export function BooksCatalogScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const {
    term: searchText,
    setTerm: setSearchText,
    effectiveTerm,
    isDebouncing,
    clear: clearSearch,
  } = useSearchTerm();

  const booksQuery = useBooksInfinite({ search: effectiveTerm || undefined, limit: PAGE_SIZE });
  const books = useMemo(() => (booksQuery.data?.pages ?? []).flatMap((page) => page.items), [booksQuery.data]);
  const isSearching = isDebouncing || booksQuery.isFetching;

  const cellWidth = grid.cellWidth;
  const goToBook = useCallback(
    (book: Book) => navigation.navigate("BookDetails", { bookId: book.id }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Book>) => (
      <BookCard
        title={item.title}
        author={item.author}
        coverUrl={item.coverUrl}
        category={item.categories[0]?.name}
        width={cellWidth}
        onPress={() => goToBook(item)}
      />
    ),
    [cellWidth, goToBook],
  );

  return (
    <View style={styles.container}>
      <TopBar title={t.books.title} large onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back}>
        <View style={styles.headerBlock}>
          <View style={styles.searchBar}>
            {/* Leading glyph doubles as the progress indicator — same idiom as Search. */}
            <View style={styles.searchGlyph}>
              {isSearching ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="search" size={18} color={theme.colors.textFaint} />
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.books.searchPlaceholder}
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

      {booksQuery.isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <BookCardSkeleton key={index} width={cellWidth} />
          ))}
        </View>
      ) : booksQuery.isError ? (
        <EmptyState
          message={t.books.loadError}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => booksQuery.refetch()}
        />
      ) : books.length === 0 ? (
        effectiveTerm ? (
          <EmptyState title={t.books.emptySearchTitle} message={t.books.emptySearchBody} icon="book-outline" />
        ) : (
          <EmptyState title={t.books.emptyLibraryTitle} message={t.books.emptyLibraryBody} icon="book-outline" />
        )
      ) : (
        <FlatList
          key={`books-grid-${grid.columns}`}
          data={books}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) booksQuery.fetchNextPage();
          }}
          ListFooterComponent={
            booksQuery.isFetchingNextPage ? (
              <ActivityIndicator color={theme.colors.primary} style={styles.footerSpinner} />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={booksQuery.isRefetching && !booksQuery.isFetchingNextPage}
              onRefresh={() => booksQuery.refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
          initialNumToRender={9}
          maxToRenderPerBatch={9}
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
  rowGap: { height: 16 },
  gridContent: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.layout.tabBarClearance,
  },
  gridRow: { gap: 12, paddingHorizontal: theme.layout.screenPadding },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 16,
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.md,
  },
  footerSpinner: { paddingVertical: theme.spacing.md },
});

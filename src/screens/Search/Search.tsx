import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Chip } from "@/components/common/Chip";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { MovieRow } from "@/components/movie/MovieRow";
import { MediaRail } from "@/components/movie/MediaRail";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import {
  AGE_RATING_LABELS,
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  DURATION_SLIDER_MAX,
  SearchFilterSheet,
  countMovieFilters,
  countSeriesFilters,
  createMovieFilters,
  createSeriesFilters,
  movieFiltersToQuery,
  seriesFiltersToQuery,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/SearchFilterSheet";
import { useMovies, useMostPurchased, useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesList, useSeriesInfinite } from "@/hooks/useSeries";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useBooksInfinite } from "@/hooks/useBooks";
import { BookCard } from "@/components/books/BookCard";
import type { Book } from "@/types/book";
import { useSearchTerm, SEARCH_MIN_LENGTH } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Movie, MovieSort } from "@/types/movie";
import type { SeriesListItem, SeriesSort } from "@/types/series";

type Props = NativeStackScreenProps<SearchStackParamList, "Search">;

type Tab = "all" | "movies" | "series" | "books" | "music";

/** How many past queries the in-memory recent list keeps. */
const RECENT_LIMIT = 6;
/** Shared empty list so the loading rails don't get a fresh array each render. */
const NO_MOVIES: Movie[] = [];
/** Both frontends page the filtered catalog with this (backend caps at 100). */
const PAGE_SIZE = 30;

/**
 * Module scope on purpose. Both are handed to FlatList, whose cells are
 * PureComponents — an inline `() => <View/>` separator or `(item) => item.id`
 * extractor would be a fresh identity on every keystroke and re-render every
 * visible row for a change that only touched the search field.
 */
function RowSeparator() {
  return <View style={styles.rowGap} />;
}
const keyExtractor = (item: { id: string }) => item.id;

/** One removable pill in the active-filters row. */
interface FilterPill {
  key: string;
  label: string;
  onRemove: () => void;
}

export function SearchScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const grid = usePosterGrid();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? "all");
  // `searchText` is what the field shows (every keystroke); `effectiveTerm` is
  // the debounced, >= SEARCH_MIN_LENGTH term that is allowed to reach a query
  // key or a filter. Nothing below should read `searchText` for filtering.
  const {
    term: searchText,
    setTerm: setSearchText,
    effectiveTerm,
    isDebouncing,
    isTooShort,
    clear: clearSearch,
  } = useSearchTerm();
  // THE canonical filter state — one object per tab, nothing else re-derives
  // or re-implements any of it. The server does all filtering and sorting.
  const [filters, setFilters] = useState<MovieFilters>(createMovieFilters);
  const [seriesFilters, setSeriesFilters] = useState<SeriesFilters>(createSeriesFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Purely local (in-memory) — nothing is persisted or sent anywhere.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Home's "Browse movies" / "Browse series" CTAs land here with `initialTab`.
  // The screen stays mounted between visits, so reading the param only in the
  // useState initializer would honour it once and ignore every later press.
  // Consume it on arrival and clear it again, which leaves the user's own
  // segment taps alone and still fires when the same tab is requested twice.
  const requestedTab = route.params?.initialTab;
  useEffect(() => {
    if (!requestedTab) return;
    setTab(requestedTab);
    navigation.setParams({ initialTab: undefined });
  }, [requestedTab, navigation]);

  // Relevance is only honest while a term is active — the server would fall
  // back to recentlyAdded anyway, so the state follows it to keep the sheet
  // and the chips row truthful when the term is cleared.
  useEffect(() => {
    if (effectiveTerm) return;
    setFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_MOVIE_SORT } : f));
    setSeriesFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_SERIES_SORT } : f));
  }, [effectiveTerm]);

  // The browse rails on the "all" tab — deliberately unfiltered.
  // Two rails, two server sorts — client-sorting one 50-row page was only
  // honest while the catalog fit in 50 rows.
  const railsQuery = useMovies({ limit: 12, sort: "rating" });
  const latestRailQuery = useMovies({ limit: 12, sort: "recentlyAdded" });
  const seriesRailQuery = useSeriesList({ limit: 100 });
  const popularQuery = useMostPurchased();

  // The filtered catalog queries. Every filter travels to the backend — there
  // is ZERO client-side catalog filtering or sorting on this screen anymore.
  const moviesQuery = useMoviesInfinite({
    search: effectiveTerm || undefined,
    ...movieFiltersToQuery(filters),
    limit: PAGE_SIZE,
  });
  const seriesQuery = useSeriesInfinite({
    search: effectiveTerm || undefined,
    ...seriesFiltersToQuery(seriesFilters),
    limit: PAGE_SIZE,
  });
  const movies = useMemo(() => moviesQuery.data?.pages.flatMap((page) => page.items) ?? [], [moviesQuery.data]);
  const series = useMemo(() => seriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [seriesQuery.data]);

  // Books live inline on this tab exactly like movies and series do — the
  // segment used to be a "go to the catalog" door, which read as broken
  // ("why are books not rendering here?"). Same search term, same grid.
  const booksQuery = useBooksInfinite({ search: effectiveTerm || undefined, limit: 24 });
  const books = useMemo(
    () => booksQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [booksQuery.data],
  );
  const renderBookItem = useCallback(
    ({ item }: { item: Book }) => (
      <BookCard
        title={item.title}
        author={item.author}
        coverUrl={item.coverUrl}
        width={grid.cellWidth}
        onPress={() => navigation.navigate("BookDetails", { bookId: item.id })}
      />
    ),
    [grid.cellWidth, navigation],
  );
  const bookKeyExtractor = useCallback((item: Book) => item.id, []);

  const recommendedMovies = useMemo(
    () => (railsQuery.data?.items ?? []),
    [railsQuery.data],
  );
  const latestMovies = useMemo(
    () => (latestRailQuery.data?.items ?? []),
    [railsQuery.data],
  );
  const popularMovies = useMemo(() => popularQuery.data ?? [], [popularQuery.data]);
  const activeFilterCount = tab === "series" ? countSeriesFilters(seriesFilters) : countMovieFilters(filters);

  // Stable identities so the browse rails' memoized cards survive a keystroke
  // in the search field or a filter change.
  const goToMovieDetails = useCallback(
    (movie: Movie) =>
      navigation.getParent()?.navigate("HomeTab", { screen: "MovieDetails", params: { movieId: movie.id } }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (series: SeriesListItem) =>
      navigation.getParent()?.navigate("HomeTab", { screen: "SeriesDetails", params: { seriesId: series.id } }),
    [navigation],
  );

  const seriesRailItems = useMemo(
    () =>
      (seriesRailQuery.data?.items ?? []).map((item) => ({
        key: item.id,
        ...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount))),
        onPress: () => goToSeriesDetails(item),
      })),
    [seriesRailQuery.data, t, goToSeriesDetails],
  );

  const rememberSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, RECENT_LIMIT));
  }, []);

  // The row renderers must not close over `searchText` — that would give them a
  // new identity on every keystroke and re-render every visible FlatList cell
  // (RN's CellRenderer is a PureComponent, so a stable renderItem is what keeps
  // the rows still). Read the field's value at press time from a ref instead.
  const searchTextRef = useRef(searchText);
  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);
  const rememberCurrentSearch = useCallback(() => rememberSearch(searchTextRef.current), [rememberSearch]);

  const cellWidth = grid.cellWidth;
  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MediaCard
        {...movieCardContent(item)}
        width={cellWidth}
        onPress={() => {
          rememberCurrentSearch();
          goToMovieDetails(item);
        }}
      />
    ),
    [cellWidth, rememberCurrentSearch, goToMovieDetails],
  );

  const renderSeriesItem = useCallback(
    ({ item }: ListRenderItemInfo<SeriesListItem>) => (
      <MediaCard
        {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
        width={cellWidth}
        onPress={() => {
          rememberCurrentSearch();
          goToSeriesDetails(item);
        }}
      />
    ),
    [t, cellWidth, rememberCurrentSearch, goToSeriesDetails],
  );

  /** The two tabs that own the search field and the filter sheet. */
  // Books ride here too: the books grid is filtered by the same search term
  // server-side, so hiding the field on that tab turned a term typed on
  // Movies into an INVISIBLE filter with no way to see or clear it.
  const isSearchTab = tab === "movies" || tab === "series" || tab === "books";
  /**
   * The loading affordance. True through the debounce window as well as the
   * request, which is the point — without the first half the field sits silent
   * for SEARCH_DEBOUNCE_MS showing the previous term's results.
   */
  const resultsQuery = tab === "series" ? seriesQuery : moviesQuery;
  const isSearching = isSearchTab && (isDebouncing || resultsQuery.isFetching);
  /**
   * The match count is the BACKEND total for the filtered query — never
   * items.length, which is only however many pages happen to be loaded.
   */
  const resultTotal = tab === "series" ? seriesQuery.data?.pages[0]?.total : moviesQuery.data?.pages[0]?.total;
  const hasActiveQuery = Boolean(effectiveTerm) || activeFilterCount > 0;
  const showRecents = isSearchTab && searchText.length === 0 && recentSearches.length > 0;
  const resetFilters = useCallback(() => {
    setFilters(createMovieFilters());
    setSeriesFilters(createSeriesFilters());
  }, []);

  const sortLabel = useCallback(
    (sort: MovieSort | SeriesSort): string => {
      switch (sort) {
        case "relevance":
          return t.search.sortRelevance;
        case "newest":
          return t.search.sortNewest;
        case "oldest":
          return t.search.sortOldest;
        case "rating":
          return t.search.sortRating;
        case "title":
          return t.search.sortTitle;
        case "mostViewed":
          return t.search.sortMostViewed;
        case "mostPurchased":
          return t.search.sortMostPurchased;
        default:
          return t.search.sortRecentlyAdded;
      }
    },
    [t],
  );

  const yearPillLabel = useCallback(
    (f: MovieFilters | SeriesFilters): string => {
      switch (f.yearPreset) {
        case "this":
          return t.search.yearPresetThis;
        case "last5":
          return t.search.yearPresetLast5;
        case "2010s":
          return "2010s";
        case "2000s":
          return "2000s";
        case "older":
          return t.search.yearPresetOlder;
        default:
          return `${f.yearFrom ?? ""}–${f.yearTo ?? ""}`;
      }
    },
    [t],
  );

  /** One pill per active value — tap removes exactly that value. */
  const filterPills = useMemo<FilterPill[]>(() => {
    const pills: FilterPill[] = [];
    if (tab === "series") {
      const f = seriesFilters;
      const set = (partial: Partial<SeriesFilters>) => setSeriesFilters((prev) => ({ ...prev, ...partial }));
      if (f.sort !== DEFAULT_SERIES_SORT)
        pills.push({ key: "sort", label: sortLabel(f.sort), onRemove: () => set({ sort: DEFAULT_SERIES_SORT }) });
      for (const genre of f.genres)
        pills.push({
          key: `genre:${genre}`,
          label: genre,
          onRemove: () => set({ genres: f.genres.filter((v) => v !== genre) }),
        });
      for (const language of f.languages)
        pills.push({
          key: `language:${language}`,
          label: language,
          onRemove: () => set({ languages: f.languages.filter((v) => v !== language) }),
        });
      if (f.yearPreset !== "any")
        pills.push({
          key: "year",
          label: yearPillLabel(f),
          onRemove: () => set({ yearPreset: "any", yearFrom: undefined, yearTo: undefined }),
        });
      if (f.access !== "ALL")
        pills.push({
          key: "access",
          label: f.access === "FREE" ? t.search.accessFree : t.search.accessSubscription,
          onRemove: () => set({ access: "ALL" }),
        });
      return pills;
    }

    const f = filters;
    const set = (partial: Partial<MovieFilters>) => setFilters((prev) => ({ ...prev, ...partial }));
    if (f.sort !== DEFAULT_MOVIE_SORT)
      pills.push({ key: "sort", label: sortLabel(f.sort), onRemove: () => set({ sort: DEFAULT_MOVIE_SORT }) });
    for (const genre of f.genres)
      pills.push({
        key: `genre:${genre}`,
        label: genre,
        onRemove: () => set({ genres: f.genres.filter((v) => v !== genre) }),
      });
    for (const language of f.languages)
      pills.push({
        key: `language:${language}`,
        label: language,
        onRemove: () => set({ languages: f.languages.filter((v) => v !== language) }),
      });
    for (const actor of f.actors)
      pills.push({
        key: `actor:${actor.id}`,
        label: actor.name,
        onRemove: () => set({ actors: f.actors.filter((a) => a.id !== actor.id) }),
      });
    for (const director of f.directors)
      pills.push({
        key: `director:${director}`,
        label: director,
        onRemove: () => set({ directors: f.directors.filter((v) => v !== director) }),
      });
    for (const country of f.countries)
      pills.push({
        key: `country:${country}`,
        label: country,
        onRemove: () => set({ countries: f.countries.filter((v) => v !== country) }),
      });
    for (const rating of f.ageRatings)
      pills.push({
        key: `ageRating:${rating}`,
        label: AGE_RATING_LABELS[rating],
        onRemove: () => set({ ageRatings: f.ageRatings.filter((v) => v !== rating) }),
      });
    if (f.yearPreset !== "any")
      pills.push({
        key: "year",
        label: yearPillLabel(f),
        onRemove: () => set({ yearPreset: "any", yearFrom: undefined, yearTo: undefined }),
      });
    if (f.ratingMin > 0 || f.ratingMax < 10)
      pills.push({
        key: "rating",
        label: `★ ${f.ratingMin}–${f.ratingMax}`,
        onRemove: () => set({ ratingMin: 0, ratingMax: 10 }),
      });
    if (f.durationBucket !== "any") {
      const label =
        f.durationBucket === "short"
          ? t.search.durationShort
          : f.durationBucket === "medium"
            ? t.search.durationMedium
            : f.durationBucket === "long"
              ? t.search.durationLong
              : `${f.durationMin ?? 0}–${
                  (f.durationMax ?? DURATION_SLIDER_MAX) >= DURATION_SLIDER_MAX
                    ? `${DURATION_SLIDER_MAX}+`
                    : f.durationMax
                } min`;
      pills.push({
        key: "duration",
        label,
        onRemove: () => set({ durationBucket: "any", durationMin: undefined, durationMax: undefined }),
      });
    }
    if (f.access !== "ALL")
      pills.push({
        key: "access",
        label: f.access === "FREE" ? t.search.accessFree : t.search.accessSubscription,
        onRemove: () => set({ access: "ALL" }),
      });
    return pills;
  }, [tab, filters, seriesFilters, sortLabel, yearPillLabel, t]);

  const listHeader = (
    <View style={styles.listHeader}>
      {showRecents ? (
        <View style={styles.recents}>
          <View style={styles.recentsHeader}>
            <ThemedText variant="overline">{t.search.recent.toUpperCase()}</ThemedText>
            <PressableScale onPress={() => setRecentSearches([])} style={styles.clearRecent} hitSlop={8}>
              <ThemedText variant="caption" weight="semibold" color={theme.colors.primary}>
                {t.search.clearRecent}
              </ThemedText>
            </PressableScale>
          </View>
          <View style={styles.recentRow}>
            {recentSearches.map((term) => (
              <Chip key={term} label={term} icon="time-outline" onPress={() => setSearchText(term)} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Only claimed while a search or filter is active, and always the
          backend's total for the filtered query — never items.length. */}
      {hasActiveQuery && resultTotal !== undefined && (
        <ThemedText variant="caption" tabular>
          {resultTotal === 1
            ? t.search.resultsCountOne
            : t.search.resultsCount.replace("{n}", String(resultTotal))}
        </ThemedText>
      )}
    </View>
  );

  /** Skeleton row while the next page streams in. */
  const listFooter =
    resultsQuery.isFetchingNextPage ? (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <AppTopBar
        trailing={
          isSearchTab ? (
            <PressableScale
              style={styles.filterButton}
              onPress={() => setFiltersOpen(true)}
              accessibilityLabel={t.search.filters}
            >
              <Ionicons name="options-outline" size={20} color={theme.colors.text} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <ThemedText variant="caption" weight="bold" tabular style={styles.filterBadgeText}>
                    {activeFilterCount}
                  </ThemedText>
                </View>
              )}
            </PressableScale>
          ) : null
        }
      >
        <View style={styles.headerBlock}>
          {isSearchTab && (
            <>
              <View style={styles.searchBar}>
                {/* The field's own glyph doubles as the progress indicator —
                    the leading search icon becomes a spinner in place, exactly
                    as the web browse bar does it. It must NOT take over the
                    trailing clear button's slot: `isSearching` is true from the
                    first keystroke through the request, which is precisely when
                    a user wants to abandon the search, and this is the only
                    clear affordance on the screen. */}
                <View style={styles.searchGlyph}>
                  {isSearching ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <Ionicons name="search" size={18} color={theme.colors.textFaint} />
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t.search.placeholder}
                  placeholderTextColor={theme.colors.textFaint}
                  value={searchText}
                  onChangeText={setSearchText}
                  returnKeyType="search"
                  autoCorrect={false}
                  onSubmitEditing={rememberCurrentSearch}
                />
                {/* Mounted for as long as there is anything to clear — never
                    gated on the loading state. */}
                {searchText.length > 0 && (
                  <PressableScale onPress={clearSearch} style={styles.clearButton} accessibilityLabel={t.common.clear}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textFaint} />
                  </PressableScale>
                )}
              </View>
              {/* A hint, not an error — the unfiltered view stays on screen. */}
              {isTooShort && (
                <ThemedText variant="caption" style={styles.hint}>
                  {t.search.minChars.replace("{n}", String(SEARCH_MIN_LENGTH))}
                </ThemedText>
              )}
            </>
          )}

          <SegmentedControl
            options={[
              { value: "all", label: t.search.all, icon: "apps-outline" },
              { value: "movies", label: t.search.movies, icon: "film-outline" },
              { value: "series", label: t.search.series, icon: "tv-outline" },
              { value: "books", label: t.search.books, icon: "book-outline" },
              { value: "music", label: t.search.music, icon: "musical-notes-outline" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </View>
      </AppTopBar>

      {/* Active filters, spelled out — one removable chip per value. */}
      {isSearchTab && filterPills.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
            keyboardShouldPersistTaps="handled"
          >
            {filterPills.map((pill) => (
              <Chip
                key={pill.key}
                label={pill.label}
                selected
                trailingIcon="close"
                onPress={pill.onRemove}
                accessibilityLabel={t.search.removeFilter.replace("{label}", pill.label)}
              />
            ))}
            <Chip label={t.search.clearAll} icon="trash-outline" onPress={resetFilters} />
          </ScrollView>
        </View>
      )}

      {tab === "all" ? (
        railsQuery.isLoading || popularQuery.isLoading ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.browseContent}>
            <MovieRow title={t.search.recommendedRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
            <MovieRow title={t.search.popularRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
          </ScrollView>
        ) : railsQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.browseContent}
            refreshControl={
              <RefreshControl
                refreshing={railsQuery.isRefetching || popularQuery.isRefetching || seriesRailQuery.isRefetching}
                onRefresh={() => {
                  railsQuery.refetch();
                  popularQuery.refetch();
                  seriesRailQuery.refetch();
                }}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.colors.surface}
              />
            }
          >
            <View style={styles.rows}>
              <MovieRow
                title={t.search.recommendedRow}
                movies={recommendedMovies}
                onPressMovie={goToMovieDetails}
                icon="sparkles-outline"
              />
              <MovieRow
                title={t.search.popularRow}
                movies={popularMovies}
                onPressMovie={goToMovieDetails}
                icon="flame-outline"
              />
              <MediaRail title={t.search.seriesRow} icon="tv-outline" items={seriesRailItems} />
              <MovieRow
                title={t.search.latestRow}
                movies={latestMovies}
                onPressMovie={goToMovieDetails}
                icon="time-outline"
              />
            </View>
          </ScrollView>
        )
      ) : tab === "books" ? (
        booksQuery.isLoading ? (
          <ResultsSkeleton />
        ) : booksQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : books.length === 0 ? (
          <EmptyState message={effectiveTerm ? t.search.noResults : t.search.booksReady} icon="book-outline" />
        ) : (
          <FlatList
            key={`books-grid-${grid.columns}`}
            data={books}
            numColumns={grid.columns}
            keyExtractor={bookKeyExtractor}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            ItemSeparatorComponent={RowSeparator}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={renderBookItem}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) {
                booksQuery.fetchNextPage();
              }
            }}
            initialNumToRender={9}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews
          />
        )
      ) : tab === "music" ? (
        <EmptyState message={t.search.musicComingSoon} icon="musical-notes-outline" />
      ) : tab === "movies" ? (
        moviesQuery.isLoading ? (
          <ResultsSkeleton />
        ) : moviesQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : movies.length === 0 ? (
          <EmptyState
            message={effectiveTerm ? t.search.noResults : t.profile.empty}
            icon="film-outline"
            actionLabel={activeFilterCount > 0 ? t.common.reset : undefined}
            onAction={activeFilterCount > 0 ? resetFilters : undefined}
          />
        ) : (
          <FlatList
            key={`movies-grid-${grid.columns}`}
            data={movies}
            numColumns={grid.columns}
            keyExtractor={keyExtractor}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            ItemSeparatorComponent={RowSeparator}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            renderItem={renderMovieItem}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (moviesQuery.hasNextPage && !moviesQuery.isFetchingNextPage) {
                moviesQuery.fetchNextPage();
              }
            }}
            refreshControl={
              <RefreshControl
                refreshing={moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage}
                onRefresh={() => moviesQuery.refetch()}
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
        )
      ) : seriesQuery.isLoading ? (
        <ResultsSkeleton />
      ) : seriesQuery.isError ? (
        <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
      ) : series.length === 0 ? (
        <EmptyState
          message={effectiveTerm ? t.search.noResults : t.profile.empty}
          icon="tv-outline"
          actionLabel={activeFilterCount > 0 ? t.common.reset : undefined}
          onAction={activeFilterCount > 0 ? resetFilters : undefined}
        />
      ) : (
        <FlatList
          key={`series-grid-${grid.columns}`}
          data={series}
          numColumns={grid.columns}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={RowSeparator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={renderSeriesItem}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (seriesQuery.hasNextPage && !seriesQuery.isFetchingNextPage) {
              seriesQuery.fetchNextPage();
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage}
              onRefresh={() => seriesQuery.refetch()}
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

      <SearchFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        tab={tab === "series" ? "series" : "movies"}
        filters={filters}
        onChangeFilters={setFilters}
        seriesFilters={seriesFilters}
        onChangeSeriesFilters={setSeriesFilters}
        total={resultTotal}
        isFetching={resultsQuery.isFetching}
        hasSearchTerm={Boolean(effectiveTerm)}
      />
    </View>
  );
}

/** Placeholder poster cells that hold the grid's shape while results load. */
function ResultsSkeleton() {
  const { cellWidth } = usePosterGrid();
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <MediaCardSkeleton key={index} width={cellWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm },
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
  /** Fixed box so the icon → spinner swap never nudges the input's width. */
  searchGlyph: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  clearButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  hint: { paddingHorizontal: theme.spacing.xs },
  filterButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: theme.colors.onPrimary },
  pillsRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.layout.screenPadding,
    paddingVertical: theme.spacing.sm,
  },
  listHeader: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.sm,
  },
  recents: { gap: theme.spacing.sm },
  recentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearRecent: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingLeft: theme.spacing.sm },
  recentRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
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
  browseContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  rows: { gap: theme.spacing.lg },
  footerLoading: { paddingVertical: theme.spacing.md, alignItems: "center" },
});

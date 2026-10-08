import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type FlatList,
  type ListRenderItemInfo,
  type TextInput,
} from "react-native";
import { useAnimatedRef } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigationState, type CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeInView } from "@/components/ui/FadeInView";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  countMovieFilters,
  countSeriesFilters,
  movieFilterChips,
  movieFiltersToQuery,
  seriesFilterChips,
  seriesFiltersToQuery,
} from "@/components/search/filters";
import { FilterRow } from "@/components/search/FilterBar";
import { SortFilterSheet } from "@/components/search/SortFilterSheet";
import { MoviePosterCell, SeriesPosterCell } from "@/components/search/PosterCell";
import { PeopleRail } from "@/components/search/PeopleRail";
import { RecentSearches } from "@/components/search/RecentSearches";
import { TrendingSection, TrendingSkeleton } from "@/components/search/TrendingSection";
import { BrowseEntry } from "@/components/search/BrowseEntry";
import { NextPageFooter } from "@/components/search/NextPageFooter";
import { useSearchGrid, type SearchGridLayout } from "@/components/search/useSearchGrid";
import { AppTopBar } from "@/components/layout/AppTopBar";
import {
  GLASS_BAR_ROW,
  GlassBarBackground,
  GlassScrollFeed,
  GlassTarget,
  useGlassBar,
} from "@/components/layout/GlassBar";
import { AppBarAction } from "@/components/layout/AppBar";
import { SearchField } from "@/components/ui/SearchField";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";
import { SearchSuggestions, type SuggestKind } from "@/components/search/SearchSuggestions";
import { SearchTabs } from "@/components/search/SearchTabs";
import { ResultsGrid } from "@/components/search/ResultsGrid";
import { ResultsRegion } from "@/components/search/ResultsRegion";
import { IdleSkeleton, ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { useMovies, useMoviesInfinite } from "@/hooks/useMovies";
import { useCategories } from "@/hooks/useCategories";
import { useSeriesList, useSeriesInfinite } from "@/hooks/useSeries";
import { useActorSearch } from "@/hooks/useActors";
import { useBooksInfinite, useBooksList } from "@/hooks/useBooks";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useDockClearance } from "@/hooks/useDockClearance";
import { BookCard } from "@/components/books/BookCard";
import { useAuthStore } from "@/store/authStore";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
import { useRecentSearchesStore } from "@/store/recentSearchesStore";
import type { Book } from "@/types/book";
import { SEARCH_MIN_LENGTH } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { MainTabParamList, RootStackParamList, SearchStackParamList } from "@/navigation/types";
import type { ActorListItem } from "@/api/actors.api";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

/**
 * Composite, like MovieDetails: the play disc on a poster plays directly, and
 * Player lives on the ROOT stack above the tabs — `getParent()?.navigate` only
 * type-checks once the tab and root param lists are in the picture.
 */
type Props = CompositeScreenProps<
  NativeStackScreenProps<SearchStackParamList, "MediaSearch">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

/** What the field searches — the scope pills. */
type Tab = NonNullable<NonNullable<SearchStackParamList["MediaSearch"]>["scope"]>;
/** The catalogue a committed search lists: "All" answers on Movies. */
type ResultsTab = Exclude<Tab, "all">;

/** Both frontends page the filtered catalog with this (backend caps at 100). */
const PAGE_SIZE = 30;
/**
 * How much of a catalogue the screen shows before a search — three, the
 * owner's number: the sections are a taste, and "See all" opens that
 * catalogue's hub on the Media tab. The books shelf asks the server for
 * exactly that many rather than slicing a bigger page.
 */
const IDLE_MOVIE_COUNT = 3;
const IDLE_SERIES_COUNT = 3;
const BOOK_SHELF_LIMIT = 3;
/**
 * "Trending searches" — the owner's approved section, filled with the
 * most-watched titles (there is no search-trend data). Five rows, the board's.
 */
const TRENDING_COUNT = 5;
/** Space between the scope pills and the body — the boards' 24pt, 8pt under the filter row. */
const BODY_TOP = 24;
/**
 * The floating bar's height under the inset before it is measured: the
 * control row, the field row (8 + 48) and the pill strip (12 + 40).
 */
const BAR_ROWS_ESTIMATE = GLASS_BAR_ROW + 56 + 52;
const BODY_TOP_UNDER_FILTERS = 8;
/** Between the count row and the first row of posters. */
const HEADER_TO_GRID = 14;
/**
 * Module scope on purpose. It is handed to FlatList, whose cells are
 * PureComponents — an inline `(item) => item.id` extractor would be a fresh
 * identity on every keystroke and re-render every visible row for a change
 * that only touched the search field.
 */
const keyExtractor = (item: { id: string }) => item.id;
/** The grid's 20pt between rows, at module scope for the same reason. */
function GridRowGap() {
  return <View style={styles.gridRowGap} />;
}

/** A fixed row of cells for the three-title sections before a search. */
function PosterRow({ grid, children }: { grid: SearchGridLayout; children: ReactNode }) {
  return <View style={[styles.posterRow, { columnGap: grid.gap, rowGap: grid.rowGap }]}>{children}</View>;
}

/**
 * One book on the Books shelf. BookCard takes a bare `onPress`, so the
 * per-book arrow is built HERE, behind memo: built inline in the screen it
 * would be a fresh function on every keystroke and re-render all three cards.
 */
const ShelfBookCard = memo(function ShelfBookCard({
  book,
  width,
  onOpen,
}: {
  book: Book;
  width: number;
  onOpen: (book: Book) => void;
}) {
  return (
    <BookCard
      title={book.title}
      author={book.author}
      coverUrl={book.coverUrl}
      category={book.categories[0]?.name}
      width={width}
      onPress={() => onOpen(book)}
    />
  );
});

/** What a result grid's automatic paging reads from its infinite query. */
interface PagedQuery {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isLoading: boolean;
  isPlaceholderData: boolean;
  fetchNextPage: (options?: { cancelRefetch?: boolean }) => Promise<unknown>;
}

/**
 * A result grid's onEndReached — automatic paging, one page at a time:
 * never while a page, the first page or a new filter's answer is on its
 * way, and never by itself after a page failed (the footer's inline Retry
 * asks again). `cancelRefetch: false` makes a second call join the page
 * already on the wire instead of asking twice.
 *
 * An end reached during a background refetch (a pull-to-refresh, a stale
 * list refreshed) is REMEMBERED and answered as soon as the refetch lands:
 * the list reports an end only once per content length, and a refetch
 * leaves the length as it was, so otherwise the next page would wait until
 * the user scrolled away and back (HubAllGrid does the same). A new filter
 * or term forgets it.
 */
function useAutoPaging({
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  isFetchNextPageError,
  isLoading,
  isPlaceholderData,
  fetchNextPage,
}: PagedQuery): () => void {
  const canPage = hasNextPage && !isFetchNextPageError;
  const newAnswer = isLoading || isPlaceholderData;
  const refetching = isFetching && !isFetchingNextPage && !newAnswer;
  const endPending = useRef(false);
  const onEndReached = useCallback(() => {
    if (!canPage || isFetchingNextPage || newAnswer) return;
    if (refetching) endPending.current = true;
    else void fetchNextPage({ cancelRefetch: false });
  }, [canPage, isFetchingNextPage, newAnswer, refetching, fetchNextPage]);
  useEffect(() => {
    if (newAnswer) endPending.current = false;
    else if (endPending.current && canPage && !isFetching) {
      endPending.current = false;
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [newAnswer, canPage, isFetching, fetchNextPage]);
  return onEndReached;
}

/**
 * Before a search, when the scope's own suggestions could not be loaded
 * (MediaSearch.dc.html, "error"): the field above still works, so the state
 * says so, and Retry asks again.
 */
function IdleError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.idleState}>
      <EmptyState
        title={t.search.idleErrorTitle}
        message={t.search.idleErrorBody}
        icon="cloud-offline-outline"
        tone={theme.colors.danger}
        fill={false}
      />
      <Button title={t.common.retry} variant="play" onPress={onRetry} labelLines={2} style={styles.idleRetry} />
    </View>
  );
}

/*
 * WHAT RENDERS WHERE — the screen's map, so a reviewer can check it
 * (docs/mobile-media-page-2026-10-02/design: MediaSearch, MediaSearchTyping,
 * MediaSearchResults, MediaSearchFilters):
 *
 *   AppTopBar   the Media tab's bar ("Media", the search button — this page,
 *               so it just hands the caret back — the bell, the avatar), then
 *               the round back button beside the big field, its hint line,
 *               and the scope pills All / Movies / Series / Books.
 *   Under pills Movies/Series, with a COMMITTED term or any filter active:
 *               the filter row — the Sort & filter pill, then a removable
 *               chip per active value (the genre or category carried over
 *               from the Media page included) and Clear all.
 *   No term committed, by scope:
 *     All / Movies   recent searches → Trending searches (most watched) →
 *                    Browse categories → Popular movies (top rated, 3).
 *     Series         recent searches → New series (3).
 *     Books          recent searches → New on the shelf (3); a guest gets
 *                    the "sign in to search books" note instead.
 *                    Each "See all" opens that catalogue's hub on the Media
 *                    root (the chip), where the full list lives.
 *   Movies, term committed — grid header = [People rail] + count row with
 *               the People pill (and Filter, when the filter row is not
 *               showing) → infinite 3-column poster grid. No movies but
 *               matching people → the header alone, in a scroll.
 *   Series, term committed — count row → infinite poster grid.
 *   Books, term committed — count row with the Authors pill → the cover
 *               grid (members).
 *   A term committed on All lands on Movies.
 *
 * The names pill is CONTEXTUAL: People → ActorsList on Movies and Series,
 * Authors → AuthorsList on Books, because a book has an author rather than a
 * cast. Both lists are their own page.
 *
 * Every filter lives in searchFiltersStore (the SearchFilters page writes it,
 * this screen sends it — the Media root's hubs list with the same store), and
 * the recent searches in recentSearchesStore, so they outlive this screen.
 *
 * THE SHARED-FILTER RULE — search + filters together: the genre or category
 * the Media page is showing, and every refinement from its Sort & filter
 * sheet, narrow these results too, exactly as one set here narrows the Media
 * page's results — but never silently. On Movies and Series the filter row
 * names every active filter as a removable chip (Free only first), even
 * before a search, so the user sees what a search will be narrowed by; Clear
 * all removes them; the Sort & filter pill counts them and opens the same
 * sheet the Media page uses. The idle suggestions themselves are
 * deliberately unfiltered.
 */
export function SearchScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  // One 3-column grid for movies, series AND books (the Marquee boards); a
  // tablet gets four or five columns.
  const grid = useSearchGrid();
  // The exact bottom padding the floating dock needs on this device.
  const dockClearance = useDockClearance();
  /**
   * The glass bar (components/layout/GlassBar): the Media bar, the field, its
   * hint line, the scope pills and the filter row all float over the page,
   * transparent at the top and frosted once results scroll under them. Every
   * body state starts below the measured bar. Only one of the body's scrolls
   * is ever mounted; each has its ref and a GlassScrollFeed beside it.
   */
  const glass = useGlassBar(BAR_ROWS_ESTIMATE);
  const idleScrollRef = useAnimatedRef<ScrollView>();
  const headerOnlyScrollRef = useAnimatedRef<ScrollView>();
  const gridRef = useAnimatedRef<FlatList>();
  /** A non-scrolling body state (an empty or error message) fills the page below the bar. */
  const underBar = useMemo(() => [styles.fill, { paddingTop: glass.barHeight }], [glass.barHeight]);
  const [tab, setTab] = useState<Tab>(route.params?.scope ?? "all");
  /* ---- the two terms -------------------------------------------------------
   * `searchText` is what the FIELD shows — every keystroke. `committedTerm` is
   * what the GRID answers, and it only ever advances when the user commits:
   * the keyboard's search key, the suggestion panel's "See all results" row,
   * the hint line under the field, or a recent-search chip. Emptying the field
   * is the one other transition, and it resets rather than advances.
   *
   * WHY there is no debounce here, which is the part a future reader will want
   * to "fix": this screen deliberately does NOT use `useSearchTerm` (the shared
   * 400ms debounced hook). The owner asked twice for the titles already on
   * screen to STAY on screen while they type — a debounce still swaps the
   * whole grid out from under them, just 400ms later. Typing must change the
   * field and its suggestion panel and nothing else, so the term feeding the
   * queries is frozen between commits.
   */
  const [searchText, setSearchText] = useState("");
  const [committedTerm, setCommittedTerm] = useState("");
  /** Typed, but still too short to search — a hint, not an error. */
  const trimmedText = searchText.trim();
  const isTooShort = trimmedText.length > 0 && trimmedText.length < SEARCH_MIN_LENGTH;
  /** Long enough to search, but not what the grid is showing — see the hint. */
  const isPendingSearch = trimmedText.length >= SEARCH_MIN_LENGTH && trimmedText !== committedTerm;
  /**
   * The catalogue a committed search lists. "All" is a set of
   * recommendations, not a result set, so its commits answer on Movies — the
   * tab the placeholder has been promising all along ("Search movies…"); the
   * effect below then moves the pill there too.
   */
  const resultsTab: ResultsTab = tab === "all" ? "movies" : tab;
  // THE canonical filter state — the shared store, one object per tab. The
  // SearchFilters page writes it; this screen only reads it (and resets it),
  // and the server does all filtering and sorting.
  const movieFilters = useSearchFiltersStore((state) => state.movieFilters);
  const seriesFilters = useSearchFiltersStore((state) => state.seriesFilters);
  const setMovieFilters = useSearchFiltersStore((state) => state.setMovieFilters);
  const setSeriesFilters = useSearchFiltersStore((state) => state.setSeriesFilters);
  const resetMovieFilters = useSearchFiltersStore((state) => state.resetMovieFilters);
  const resetSeriesFilters = useSearchFiltersStore((state) => state.resetSeriesFilters);
  // In memory only (nothing is persisted or sent anywhere), and in a store so
  // closing this screen and opening it again keeps them.
  const recentSearches = useRecentSearchesStore((state) => state.terms);
  const rememberSearch = useRecentSearchesStore((state) => state.remember);
  const clearRecentSearches = useRecentSearchesStore((state) => state.clear);

  // The Media root's search button opens this screen on its chip's scope.
  // The screen can also be reached while already open (Browse's search
  // button pops back to it), so the param is consumed on every arrival and
  // cleared again, which leaves the user's own pill taps alone.
  const requestedScope = route.params?.scope;
  useEffect(() => {
    if (!requestedScope) return;
    setTab(requestedScope);
    navigation.setParams({ scope: undefined });
  }, [requestedScope, navigation]);

  // A term COMMITTED on All lands on Movies (see `resultsTab`). Keyed off the
  // committed term, not the typed text, so typing never swaps the body.
  useEffect(() => {
    if (tab === "all" && committedTerm) setTab("movies");
  }, [tab, committedTerm]);

  // Relevance is only honest while a term is actually in the query — the server
  // would fall back to recentlyAdded anyway, so the state follows the COMMITTED
  // term (what the query holds), not the box, to keep the filters page and the
  // filter row truthful. Written to the store, the same place the page does.
  useEffect(() => {
    if (committedTerm) return;
    setMovieFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_MOVIE_SORT } : f));
    setSeriesFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_SERIES_SORT } : f));
  }, [committedTerm, setMovieFilters, setSeriesFilters]);
  // …and the Media root's hubs list with the same store and never have a
  // term, so a Relevance picked here must not outlive this screen either.
  useEffect(
    () => () => {
      setMovieFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_MOVIE_SORT } : f));
      setSeriesFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_SERIES_SORT } : f));
    },
    [setMovieFilters, setSeriesFilters],
  );

  /* ---- before a search: each scope's suggestions, deliberately unfiltered ----
   * Asked only while that scope is on screen; React Query keeps what came
   * back, so switching back is instant.
   */
  const movieScope = tab === "all" || tab === "movies";
  // Top-rated first: the three "Popular movies" are the best-rated three,
  // which "See all" then widens.
  const railsQuery = useMovies({ limit: IDLE_MOVIE_COUNT, sort: "rating" }, { enabled: movieScope });
  /**
   * "Trending searches": the most-watched titles. Its own small request; if it
   * fails or comes back empty the section is simply not drawn — it is a
   * recommendation, and the rest of the scope must not depend on it.
   */
  const trendingQuery = useMovies({ limit: TRENDING_COUNT, sort: "mostViewed" }, { enabled: movieScope });
  const trendingMovies = useMemo(() => trendingQuery.data?.items ?? [], [trendingQuery.data]);
  const seriesRailQuery = useSeriesList({ limit: IDLE_SERIES_COUNT }, { enabled: tab === "series" });

  /**
   * The books shelf. Newest-first is simply what /books returns, so there is
   * nothing to sort — the first row IS "new on the shelf".
   *
   * The library is MEMBERS-ONLY (/books 401s a guest while movies and series
   * read publicly), so the query is gated on the session: a signed-out viewer
   * never asks, and gets the sign-in note rather than a failure.
   */
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const bookShelfQuery = useBooksList({ limit: BOOK_SHELF_LIMIT }, { enabled: isAuthenticated && tab === "books" });
  const shelfBooks = useMemo(() => bookShelfQuery.data?.items ?? [], [bookShelfQuery.data]);

  /**
   * What the play disc on a poster may do — the same `hasAccess` rule
   * MovieDetails applies to its own CTA, read once here for every cell.
   * Gated on the session: the endpoint 401s a guest, and a guest is simply
   * not subscribed.
   */
  const subscriptionQuery = useSubscriptionStatus({ enabled: isAuthenticated });
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;

  // The filtered catalog queries. Every filter travels to the backend — there
  // is ZERO client-side catalog filtering or sorting on this screen.
  // `committedTerm`, never `searchText`: a keystroke must not change the key.
  // Nothing is asked before a term is committed: the lists without one are
  // the Media root's hubs.
  const hasTerm = committedTerm.length > 0;
  const moviesQuery = useMoviesInfinite(
    { search: committedTerm || undefined, ...movieFiltersToQuery(movieFilters), limit: PAGE_SIZE },
    { enabled: hasTerm },
  );
  const seriesQuery = useSeriesInfinite(
    { search: committedTerm || undefined, ...seriesFiltersToQuery(seriesFilters), limit: PAGE_SIZE },
    { enabled: hasTerm },
  );
  const movies = useMemo(() => moviesQuery.data?.pages.flatMap((page) => page.items) ?? [], [moviesQuery.data]);
  const series = useMemo(() => seriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [seriesQuery.data]);

  /**
   * The people the term matches — the rail of faces above the results. The
   * hook fires from one character (names are short), so the screen applies
   * the catalogue's own minimum here: below it the query is disabled AND the
   * list is forced empty, because keepPreviousData would otherwise hold the
   * last term's faces over an empty field. Committed term only — typing must
   * not move the rail either. Gated on the scope as well: the rail renders
   * ONLY on Movies, so asking /actors from Series or Books would be a
   * request whose answer nothing could display.
   */
  const peopleTerm = resultsTab === "movies" && committedTerm.length >= SEARCH_MIN_LENGTH ? committedTerm : "";
  const actorsQuery = useActorSearch(peopleTerm);
  const actors = useMemo(() => (peopleTerm ? (actorsQuery.data?.items ?? []) : []), [peopleTerm, actorsQuery.data]);

  // Books are searched exactly like movies and series — same term, same grid.
  // PAGE_SIZE, like the two grids above: `limit` is part of the cache key.
  // Gated like the shelf: /books 401s a guest, so an ungated grid would turn
  // "you need an account" into an error that blames the connection.
  const booksQuery = useBooksInfinite(
    { search: committedTerm || undefined, limit: PAGE_SIZE },
    { enabled: isAuthenticated && hasTerm },
  );
  const books = useMemo(() => booksQuery.data?.pages.flatMap((page) => page.items) ?? [], [booksQuery.data]);
  // Shared by the books grid and the shelf, and stable so neither one's
  // memoized cells are rebuilt by a keystroke in the field above them.
  const goToBookDetails = useCallback(
    (book: Book) => navigation.navigate("BookDetails", { bookId: book.id }),
    [navigation],
  );
  const renderBookItem = useCallback(
    ({ item }: { item: Book }) => (
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
  const bookKeyExtractor = useCallback((item: Book) => item.id, []);

  /** "Popular movies" — the top-rated three. Sliced in the memo so identity holds across keystrokes. */
  const popularMovies = useMemo(() => (railsQuery.data?.items ?? []).slice(0, IDLE_MOVIE_COUNT), [railsQuery.data]);
  /** "New series" — the first three of the newest. */
  const newSeries = useMemo(
    () => (seriesRailQuery.data?.items ?? []).slice(0, IDLE_SERIES_COUNT),
    [seriesRailQuery.data],
  );

  /** The visible results' active-filter count — books have no filters, so 0 there. */
  const activeFilterCount =
    resultsTab === "series"
      ? countSeriesFilters(seriesFilters)
      : resultsTab === "movies"
        ? countMovieFilters(movieFilters)
        : 0;
  /**
   * One chip per active value on the visible results (empty when nothing is
   * active), the genre or category carried over from the Media page
   * included. Each chip's ✕ removes just its own value, in place.
   */
  const categoriesQuery = useCategories();
  const movieCategoryId = movieFilters.categoryId;
  const categoryName = useMemo(
    () => (movieCategoryId ? (categoriesQuery.data?.find((c) => c.id === movieCategoryId)?.name ?? null) : null),
    [movieCategoryId, categoriesQuery.data],
  );
  const filterChips = useMemo(
    () =>
      resultsTab === "series"
        ? seriesFilterChips(t, seriesFilters, setSeriesFilters, { selection: true })
        : resultsTab === "movies"
          ? movieFilterChips(t, movieFilters, setMovieFilters, { selection: true, categoryName })
          : [],
    [resultsTab, t, seriesFilters, movieFilters, setSeriesFilters, setMovieFilters, categoryName],
  );

  // Stable identities so the memoized cells survive a keystroke in the search
  // field or a filter change.
  //
  // These push onto THIS stack (MovieDetails/SeriesDetails/ActorDetails are
  // registered in every stack that can open one — see SearchStackNavigator),
  // so back returns to the results. `navigate` pushes here because the target
  // name is never the focused route (this screen is).
  const goToMovieDetails = useCallback(
    (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (item: SeriesListItem) => navigation.navigate("SeriesDetails", { seriesId: item.id }),
    [navigation],
  );
  const goToActorDetails = useCallback(
    (actor: ActorListItem) => navigation.navigate("ActorDetails", { actorId: actor.id }),
    [navigation],
  );
  /** The door to the Browse page (registered on every stack by the titles area). */
  const openBrowse = useCallback(() => navigation.navigate("Browse"), [navigation]);
  /**
   * The Sort & filter sheet — the Media page's own, over the same store, told
   * the committed term (its result count runs the same query as the grid,
   * and "Relevance" is only offered with a term).
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  const openFilters = useCallback(() => {
    Keyboard.dismiss();
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  /**
   * The sheet's "All filters" link: the full filters page (several genres or
   * languages at once). It reads and writes the store directly — nothing
   * comes back through params — and pops back here.
   */
  const openAllFilters = useCallback(
    () => navigation.navigate("SearchFilters", { tab: resultsTab === "series" ? "series" : "movies", term: committedTerm }),
    [navigation, resultsTab, committedTerm],
  );
  /**
   * The names pill's two destinations — the actors list and its books twin.
   * Neither takes params: both screens carry their own search field, and this
   * screen's term is a question about the catalogue, not about the people.
   */
  const openPeople = useCallback(() => navigation.navigate("ActorsList"), [navigation]);
  const openAuthors = useCallback(() => navigation.navigate("AuthorsList"), [navigation]);
  /** The filter row's Clear and the no-results Reset — the VISIBLE results' filters only. */
  const clearTabFilters = useCallback(() => {
    if (resultsTab === "series") resetSeriesFilters();
    else resetMovieFilters();
  }, [resultsTab, resetMovieFilters, resetSeriesFilters]);
  /**
   * The play disc on a movie poster. Plays directly when the viewer has access
   * — Player is on the root stack, above the tabs, which is why this goes
   * through `getParent()` exactly as MovieDetails' own CTA does — and
   * otherwise opens MovieDetails, where the subscribe CTA and the locked note
   * live. The cell never learns about subscriptions; this is the one place
   * the rule is applied on this screen.
   */
  const watchMovie = useCallback(
    (movie: Movie) => {
      if (hasAccess(movie.accessType, isSubscribed)) {
        navigation.getParent()?.navigate("Player", { movieId: movie.id });
      } else {
        goToMovieDetails(movie);
      }
    },
    [navigation, isSubscribed, goToMovieDetails],
  );
  /**
   * The sections' "See all" — the whole catalogue is that catalogue's hub on
   * the Media root, so these go back there on the matching chip rather than
   * pushing a near-duplicate list.
   */
  const showAllMovies = useCallback(() => navigation.popTo("Search", { initialTab: "movies" }), [navigation]);
  const showAllSeries = useCallback(() => navigation.popTo("Search", { initialTab: "series" }), [navigation]);
  const showAllBooks = useCallback(() => navigation.popTo("Search", { initialTab: "books" }), [navigation]);
  /** The round back button: back where the screen was opened from (the Media root, usually). */
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Search");
  }, [navigation]);
  /**
   * …and it says where that is (MediaSearch.dc.html: "Back to Media"). The
   * Media root's search button, and Browse on the Home tab or Profile (which
   * lands here with the root underneath), both go back to the Media page; the
   * Media tab's own Browse goes back to Browse, so there it is plain "Back".
   */
  const backToMedia = useNavigationState((state) => {
    const at = state.routes.findIndex((entry) => entry.key === route.key);
    return at <= 0 || state.routes[at - 1]?.name === "Search";
  });

  // The cell renderers must not close over either term — that would give them
  // a new identity on every keystroke and re-render every visible FlatList
  // cell. Read the value at press time from a ref instead.
  const committedTermRef = useRef(committedTerm);
  useEffect(() => {
    committedTermRef.current = committedTerm;
  }, [committedTerm]);
  const searchTextRef = useRef(searchText);
  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);

  /**
   * Recents, split by what actually got searched.
   *
   * A cell in the grid belongs to the COMMITTED term — the grid is frozen while
   * the user types, so opening a poster with "spid" half-typed in the box must
   * not file "spid" as a past search that was never run. A suggestion row is
   * the opposite case: the panel genuinely did search the live text, so that
   * path records it.
   */
  const rememberCommittedSearch = useCallback(() => rememberSearch(committedTermRef.current), [rememberSearch]);
  const rememberTypedSearch = useCallback(() => rememberSearch(searchTextRef.current), [rememberSearch]);

  const inputRef = useRef<TextInput | null>(null);
  /** The bar's search button names this very page: it just hands the caret back. */
  const focusField = useCallback(() => inputRef.current?.focus(), []);

  /* ---- the suggestion panel ----------------------------------------------
   * One panel per catalogue — movies, series and books each list their own
   * rows — each with its own 150ms debounce and its own query key, never the
   * grid's. It hangs under the SCOPE PILLS (the Marquee board), so the pills
   * stay tappable while typing, and it dims the content behind it; a tap on
   * the dim closes it. Its only reach into the grid is the "See all results"
   * footer, which runs the same `commitSearch` the keyboard's search key does.
   */
  const containerRef = useRef<View | null>(null);
  const tabsRef = useRef<View | null>(null);
  /**
   * Where the panel hangs instead when the pills sit too low to leave room
   * above the keyboard (short phones, 2× text): under the hint line, then
   * under the field — the old anchor, so it never vanishes where it used to fit.
   */
  const hintRef = useRef<View | null>(null);
  const fieldRef = useRef<View | null>(null);
  const fallbackAnchorRefs = useMemo(() => [hintRef, fieldRef], []);
  /** Bumped whenever the pill strip lays out, so an open panel re-measures where it hangs. */
  const [anchorKey, setAnchorKey] = useState(0);
  const bumpAnchor = useCallback(() => setAnchorKey((key) => key + 1), []);
  const [fieldFocused, setFieldFocused] = useState(false);
  // Picking a row closes the panel even though the field keeps its text; any
  // further typing (or a fresh focus) means the user wants suggestions again.
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  const handleFieldFocus = useCallback(() => {
    setSuggestDismissed(false);
    setFieldFocused(true);
  }, []);
  const handleFieldBlur = useCallback(() => setFieldFocused(false), []);
  const handleChangeSearchText = useCallback((next: string) => {
    setSuggestDismissed(false);
    setSearchText(next);
    // The ONE keystroke that is allowed to move the grid, and only because the
    // alternative is worse: an empty box sitting over "Results for spider"
    // reads as broken, and a held backspace must not end up somewhere the X
    // button would not. Emptying the field therefore resets the committed term
    // and the pre-search sections come back.
    if (next.trim().length === 0) setCommittedTerm("");
  }, []);

  /**
   * The commit. Every route to full results runs exactly this: the keyboard's
   * search key, the panel's "See all results" row and the hint line under the
   * field (and, with its own term, a recent-search chip). Below
   * SEARCH_MIN_LENGTH it is a deliberate no-op — the min-chars hint under the
   * field already says why nothing happened.
   */
  const commitSearch = useCallback(() => {
    if (trimmedText.length < SEARCH_MIN_LENGTH) return;
    const trimmed = trimmedText;
    setCommittedTerm(trimmed);
    rememberSearch(trimmed);
    // Close the panel from the press itself rather than waiting on a blur that
    // may not arrive, so it cannot flash back over the results it just asked
    // for. Never re-focus on a commit: that would reopen the panel on top of
    // them.
    setSuggestDismissed(true);
    inputRef.current?.blur();
  }, [trimmedText, rememberSearch]);

  /** The X button — both terms in one handler, so the pre-search sections come back. */
  const clearSearch = useCallback(() => {
    setSearchText("");
    setCommittedTerm("");
  }, []);

  /**
   * A recent chip. A past query is already a whole question, so the tap IS the
   * search — it commits immediately and does NOT hand the caret back (that
   * would pop the suggestion panel open on top of the results it produced).
   */
  const replayRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      setSearchText(term);
      setCommittedTerm(trimmed);
      rememberSearch(trimmed);
      setSuggestDismissed(true);
      inputRef.current?.blur();
    },
    [rememberSearch],
  );

  /** A tap on the dim behind the panel: close it and put the keyboard away. */
  const dismissSuggestions = useCallback(() => {
    setSuggestDismissed(true);
    inputRef.current?.blur();
  }, []);

  // Android's hardware back hides the keyboard WITHOUT blurring the field,
  // which would leave the panel floating over a keyboardless screen. Blur as
  // well as close, so the field's state matches what the platform already did
  // and the next tap on it fires onFocus again. The grids' own
  // keyboardDismissMode="on-drag" arrives here too.
  useEffect(() => {
    if (!fieldFocused) return;
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      setFieldFocused(false);
      inputRef.current?.blur();
    });
    return () => subscription.remove();
  }, [fieldFocused]);

  /**
   * Which catalogue the panel lists — every scope gets its own rows. "All"
   * borrows the movies panel because that is where its commits land.
   *
   * A SIGNED-OUT viewer gets no books panel, for the same reason the grid and
   * the shelf are gated: its rows come from /books, which 401s a guest — and
   * a 401 forces a logout, which empties the query cache. `null` keeps the
   * panel closed rather than unmounting mid-animation.
   */
  const suggestKind: SuggestKind | null =
    resultsTab === "series" ? "series" : resultsTab === "books" ? (isAuthenticated ? "books" : null) : "movies";

  /** The field names what it will actually search — derived from the same scope as the panel. */
  const searchPlaceholder =
    resultsTab === "series"
      ? t.search.placeholderSeries
      : resultsTab === "books"
        ? t.search.placeholderBooks
        : t.search.placeholderMovies;

  /** It reads the LIVE text, on purpose: the panel answers every keystroke while the grid holds still. */
  const suggestionsVisible =
    fieldFocused && !suggestDismissed && suggestKind !== null && searchText.trim().length >= SEARCH_MIN_LENGTH;

  /**
   * What every suggestion row does before it navigates, spelled once so the
   * three kinds cannot drift apart. Close first, from the row's own press.
   * Then the recents path: the LIVE text, because the panel really did search
   * it, so it earns its place in recents even though the grid never ran it.
   */
  const dismissAndRemember = useCallback(() => {
    setSuggestDismissed(true);
    inputRef.current?.blur();
    rememberTypedSearch();
  }, [rememberTypedSearch]);

  const selectSuggestion = useCallback(
    (movie: Movie) => {
      dismissAndRemember();
      goToMovieDetails(movie);
    },
    [dismissAndRemember, goToMovieDetails],
  );
  const selectSeriesSuggestion = useCallback(
    (item: SeriesListItem) => {
      dismissAndRemember();
      goToSeriesDetails(item);
    },
    [dismissAndRemember, goToSeriesDetails],
  );
  const selectBookSuggestion = useCallback(
    (book: Book) => {
      dismissAndRemember();
      goToBookDetails(book);
    },
    [dismissAndRemember, goToBookDetails],
  );

  // The grid's row wrapper: the screen margins plus the column gap the cell
  // width was measured from.
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);
  /** Roughly three rows of the grid per render batch. */
  const renderBatch = grid.columns * 3;
  /** The grid's bottom padding clears the floating dock on this device. */
  const gridContentStyle = useMemo(
    () => ({ paddingTop: glass.barHeight, paddingBottom: dockClearance }),
    [glass.barHeight, dockClearance],
  );

  /**
   * Opening a cell from the results files the COMMITTED term as a recent (see
   * `rememberCommittedSearch`); the pre-search sections' cells use the bare
   * navigation, because nothing there was searched. Stable, so the memoized
   * cells do not re-render on a keystroke.
   */
  const openMovieResult = useCallback(
    (movie: Movie) => {
      rememberCommittedSearch();
      goToMovieDetails(movie);
    },
    [rememberCommittedSearch, goToMovieDetails],
  );
  const openSeriesResult = useCallback(
    (item: SeriesListItem) => {
      rememberCommittedSearch();
      goToSeriesDetails(item);
    },
    [rememberCommittedSearch, goToSeriesDetails],
  );
  // The results grid wears the crimson NEW tab on titles added in the last
  // NEW_TITLE_WINDOW_DAYS — Browse's, CategoryDetail's and the hubs' rule
  // (isRecentlyAdded on createdAt), never a guess. Books results are left
  // as they are: no book grid anywhere marks NEW (the Books hub stamps it
  // only on its hero and "New on the shelf"), and BookCard draws no tab.
  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MoviePosterCell movie={item} width={grid.cellWidth} onPress={openMovieResult} onWatch={watchMovie} markNew />
    ),
    [grid.cellWidth, openMovieResult, watchMovie],
  );
  const renderSeriesItem = useCallback(
    ({ item }: ListRenderItemInfo<SeriesListItem>) => (
      <SeriesPosterCell series={item} width={grid.cellWidth} onPress={openSeriesResult} markNew />
    ),
    [grid.cellWidth, openSeriesResult],
  );

  /**
   * Stable grid props. FlatList is a PureComponent, so a fresh arrow or a fresh
   * `<RefreshControl>` element would force a whole VirtualizedList pass on
   * every keystroke — exactly what the committed-term model exists to prevent.
   * query-core binds `refetch` and `fetchNextPage` once, so these hold. Each
   * grid pages by itself, one page at a time (useAutoPaging).
   */
  const moviesEndReached = useAutoPaging(moviesQuery);

  const moviesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage}
        onRefresh={() => moviesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
        progressViewOffset={glass.barHeight}
      />
    ),
    [moviesQuery.isRefetching, moviesQuery.isFetchingNextPage, moviesQuery.refetch, glass.barHeight],
  );

  const seriesEndReached = useAutoPaging(seriesQuery);

  const seriesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage}
        onRefresh={() => seriesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
        progressViewOffset={glass.barHeight}
      />
    ),
    [seriesQuery.isRefetching, seriesQuery.isFetchingNextPage, seriesQuery.refetch, glass.barHeight],
  );

  const booksEndReached = useAutoPaging(booksQuery);
  /** The footer's inline Retry after a failed page — the one call the guards above leave to the user. */
  const fetchNextMovies = moviesQuery.fetchNextPage;
  const fetchNextSeries = seriesQuery.fetchNextPage;
  const fetchNextBooks = booksQuery.fetchNextPage;
  const retryNextPage = useCallback(() => {
    const fetchNext =
      resultsTab === "series" ? fetchNextSeries : resultsTab === "books" ? fetchNextBooks : fetchNextMovies;
    void fetchNext({ cancelRefetch: false });
  }, [resultsTab, fetchNextMovies, fetchNextSeries, fetchNextBooks]);

  /**
   * Hoisted: this strip sits right under the field and none of it can change
   * while the user types, so a keystroke must not rebuild it.
   */
  const tabOptions = useMemo(
    () => [
      { value: "all", label: t.search.all },
      { value: "movies", label: t.search.movies },
      { value: "series", label: t.search.series },
      { value: "books", label: t.search.books },
    ],
    [t],
  );
  const handleTabChange = useCallback((v: string) => setTab(v as Tab), []);

  /**
   * Per-tab query facts, read off the one query that owns the visible grid.
   * Spelled out per tab so each value keeps its own concrete type.
   */
  const resultTotal =
    resultsTab === "series"
      ? seriesQuery.data?.pages[0]?.total
      : resultsTab === "books"
        ? booksQuery.data?.pages[0]?.total
        : moviesQuery.data?.pages[0]?.total;
  /**
   * The grid on screen is the PREVIOUS term's, held over by keepPreviousData.
   * It stays interactive but fades, and the count above it becomes a skeleton
   * bar, so a fresh number is never read as a caption for stale posters.
   */
  const resultsStale =
    resultsTab === "series"
      ? seriesQuery.isPlaceholderData
      : resultsTab === "books"
        ? booksQuery.isPlaceholderData
        : moviesQuery.isPlaceholderData;
  const isFetchingNextPage =
    resultsTab === "series"
      ? seriesQuery.isFetchingNextPage
      : resultsTab === "books"
        ? booksQuery.isFetchingNextPage
        : moviesQuery.isFetchingNextPage;
  /**
   * The automatic next page failed and there is still more to load — the
   * footer then offers an inline Retry (scrolling cannot retry: the end of
   * the list was already reached).
   */
  const nextPageFailed =
    resultsTab === "series"
      ? seriesQuery.isFetchNextPageError && seriesQuery.hasNextPage
      : resultsTab === "books"
        ? booksQuery.isFetchNextPageError && booksQuery.hasNextPage
        : moviesQuery.isFetchNextPageError && moviesQuery.hasNextPage;
  /**
   * The whole-grid error state, per tab. TanStack v5 flips `isError` for a
   * failed NEXT page too, but the pages already loaded are still in hand —
   * so only a first-page (or refresh) failure swaps the grid for the error
   * state; a next-page failure keeps the grid and its inline Retry footer.
   */
  const moviesFailed = moviesQuery.isError && !moviesQuery.isFetchNextPageError;
  const seriesFailed = seriesQuery.isError && !seriesQuery.isFetchNextPageError;
  const booksFailed = booksQuery.isError && !booksQuery.isFetchNextPageError;
  const tabQueryError = resultsTab === "movies" ? moviesFailed : resultsTab === "series" ? seriesFailed : false;
  /*
   * No busy glyph in the field: the boards forbid spinners (AREA-NOTES), and
   * a commit already shows itself — the held-over grid fades and its count
   * turns into a skeleton bar, a first load draws skeleton cells, the next
   * page a skeleton row and a refresh the platform's pull indicator.
   */

  /**
   * The filter row under the pills — Movies and Series: with a committed term
   * (results), or before one while any filter is active, so what a search
   * will be narrowed by is in view and removable. While the grid is in its
   * error state the row stays only if something is active, so Clear all
   * remains reachable.
   */
  const showFilterRow =
    (resultsTab === "movies" || resultsTab === "series") &&
    (activeFilterCount > 0 || (hasTerm && !tabQueryError));
  const bodyTop = showFilterRow ? BODY_TOP_UNDER_FILTERS : BODY_TOP;

  /**
   * The match count of a results view — or null while the number in hand
   * describes the PREVIOUS query (held-over placeholder pages), because a
   * wrong count is worse than none. The line NAMES the committed term — "12
   * results for “inception”" — which keeps the screen honest while the user
   * types something else.
   */
  const countLabel = useMemo(() => {
    if (resultTotal === undefined || resultsStale) return null;
    const template = resultTotal === 1 ? t.search.resultsForTermCountOne : t.search.resultsForTermCount;
    return template.replace("{n}", String(resultTotal)).replace("{term}", committedTerm);
  }, [resultTotal, resultsStale, committedTerm, t]);

  /**
   * The count row's Sort & filter pill — on Movies and Series, and only while the
   * filter row is NOT showing (it carries its own), so the control is never
   * drawn twice. Books has no filters, so no pill there.
   */
  const filterControl = useMemo(
    () =>
      (resultsTab === "movies" || resultsTab === "series") && !showFilterRow
        ? { count: activeFilterCount, onPress: openFilters }
        : undefined,
    [resultsTab, showFilterRow, activeFilterCount, openFilters],
  );

  /**
   * The count row's names pill: People (actors list) on Movies and Series,
   * Authors (authors list) on Books — same pill, same place.
   */
  const peopleControl = useMemo(
    () =>
      resultsTab === "books"
        ? { label: t.search.authors, icon: "create-outline" as const, onPress: openAuthors }
        : { label: t.search.people, icon: "people-outline" as const, onPress: openPeople },
    [resultsTab, t, openAuthors, openPeople],
  );

  /**
   * Shared by the no-results branches so they read as one state. It quotes
   * the COMMITTED term — the one that was actually searched (a results view
   * only exists with one). The reset clears the visible results' filters.
   */
  const emptyResultProps = useMemo(
    () => ({
      title: t.search.noResultsTitle,
      message: t.search.noResultsBody.replace("{term}", committedTerm),
      actionLabel: activeFilterCount > 0 ? t.common.reset : undefined,
      onAction: activeFilterCount > 0 ? clearTabFilters : undefined,
    }),
    [committedTerm, activeFilterCount, t, clearTabFilters],
  );

  /**
   * The faces section, or nothing — the Marquee board's 84pt discs. One
   * element, memoized, used in the Movies grid header (and that tab's
   * "people but no movies" fallback). Committed state only.
   */
  const peopleRail = useMemo(
    () =>
      actors.length > 0 ? <PeopleRail actors={actors} onPress={goToActorDetails} icon={null} avatarSize={84} /> : null,
    [actors, goToActorDetails],
  );

  /**
   * The results grid's header. Memoized so a keystroke re-renders NOTHING
   * below the field — every value it reads is committed state. Order: people
   * (Movies) — the count row.
   */
  const listHeader = useMemo(
    () => (
      <View style={[styles.listHeader, { paddingTop: bodyTop }]}>
        {resultsTab === "movies" && peopleRail ? <View style={styles.headerSection}>{peopleRail}</View> : null}
        <SearchResultsHeader countLabel={countLabel} filter={filterControl} people={peopleControl} />
      </View>
    ),
    [bodyTop, resultsTab, peopleRail, countLabel, filterControl, peopleControl],
  );

  /**
   * The grid's footer: a skeleton row while the next page streams in, an
   * inline Retry after a failed one. Memoized like the header — a fresh
   * element per render would make FlatList re-render on every keystroke.
   */
  const listFooter = useMemo(
    () => (
      <NextPageFooter
        grid={grid}
        kind={resultsTab === "books" ? "book" : "poster"}
        loading={isFetchingNextPage}
        failed={!isFetchingNextPage && nextPageFailed}
        onRetry={retryNextPage}
      />
    ),
    [grid, resultsTab, isFetchingNextPage, nextPageFailed, retryNextPage],
  );

  const hintVisible = isTooShort || isPendingSearch;
  const pendingLabel = t.search.pendingSearch.replace("{term}", trimmedText);

  /** The body's padding everywhere a plain scroll stands in for the grid: under the bar, clear of the dock. */
  const scrollBottom = useMemo(
    () => ({ paddingTop: glass.barHeight, paddingBottom: dockClearance }),
    [glass.barHeight, dockClearance],
  );
  /** Before a search: 24pt under the bar's pills, clear of the dock. */
  const idleScrollContent = useMemo(
    () => ({ paddingTop: glass.barHeight + BODY_TOP, paddingBottom: dockClearance }),
    [glass.barHeight, dockClearance],
  );

  /* ---- before a search: the scope's own sections ---- */
  const idleScope: "movies" | "series" | "books" = resultsTab;
  const recentsBlock =
    recentSearches.length > 0 ? (
      <RecentSearches terms={recentSearches} onReplay={replayRecent} onClear={clearRecentSearches} />
    ) : null;
  const idleLoading =
    idleScope === "movies"
      ? railsQuery.isLoading
      : idleScope === "series"
        ? seriesRailQuery.isLoading
        : isAuthenticated && bookShelfQuery.isLoading;
  const idleFailed =
    idleScope === "movies"
      ? railsQuery.isError && !railsQuery.data
      : idleScope === "series"
        ? seriesRailQuery.isError && !seriesRailQuery.data
        : isAuthenticated && bookShelfQuery.isError && !bookShelfQuery.data;
  const idleRefreshing =
    idleScope === "movies"
      ? railsQuery.isRefetching || trendingQuery.isRefetching
      : idleScope === "series"
        ? seriesRailQuery.isRefetching
        : bookShelfQuery.isRefetching;
  /**
   * Retry and pull-to-refresh before a search: the scope's own requests.
   * The guards are load-bearing, not caution: refetch() ignores `enabled`,
   * so an unconditional call would fire requests for a scope that is not on
   * screen — and a guest's /books request, the one the gate exists to avoid.
   */
  const refetchIdle = useCallback(() => {
    if (idleScope === "movies") {
      void railsQuery.refetch();
      void trendingQuery.refetch();
    } else if (idleScope === "series") {
      void seriesRailQuery.refetch();
    } else if (isAuthenticated) {
      void bookShelfQuery.refetch();
    }
  }, [idleScope, isAuthenticated, railsQuery.refetch, trendingQuery.refetch, seriesRailQuery.refetch, bookShelfQuery.refetch]);

  const idleBody = (
    <>
      <ScrollView
        ref={idleScrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.idleContent, idleScrollContent]}
        // The field lives above these sections: a drag puts its keyboard away,
        // and a tap on a card still lands while it is up.
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          idleScope === "books" && !isAuthenticated ? undefined : (
            <RefreshControl
              refreshing={idleRefreshing && !idleLoading}
              onRefresh={refetchIdle}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={glass.barHeight}
            />
          )
        }
      >
        {recentsBlock}

        {idleScope === "books" && !isAuthenticated ? (
          /* Before any query state is read: with the shelf gated off, a guest's
             query never leaves `pending`. Say what is actually true instead —
             the shelf needs an account. */
          <EmptyState
            title={t.search.booksSignedOutSearchTitle}
            message={t.search.booksSignedOutSearchBody}
            icon="lock-closed-outline"
            fill={false}
          />
        ) : idleFailed ? (
          <IdleError onRetry={refetchIdle} />
        ) : idleScope === "movies" ? (
          /* One tree while loading AND loaded (MediaSearch.dc.html): only the
             two lists swap skeleton → content, each with the board's entrance
             fade, while Browse categories — which needs no data — is there and
             tappable from the first frame. */
          <View style={styles.idleSections}>
            {/* Most watched — tapping a row opens the title. */}
            {trendingQuery.isLoading ? (
              <TrendingSkeleton />
            ) : trendingMovies.length > 0 ? (
              <FadeInView duration={280}>
                <TrendingSection movies={trendingMovies} onPress={goToMovieDetails} />
              </FadeInView>
            ) : null}

            <BrowseEntry onPress={openBrowse} />

            {railsQuery.isLoading ? (
              <IdleSkeleton grid={grid} title={t.search.popularMovies} kind="poster" />
            ) : popularMovies.length > 0 ? (
              <FadeInView duration={280}>
                <SectionHeader
                  titleLines={2}
                  title={t.search.popularMovies}
                  subtitle={t.search.sortRating}
                  onSeeAll={showAllMovies}
                  seeAllLabel={t.common.seeAll}
                  seeAllTone="text"
                />
                <PosterRow grid={grid}>
                  {popularMovies.map((movie) => (
                    <MoviePosterCell
                      key={movie.id}
                      movie={movie}
                      width={grid.cellWidth}
                      onPress={goToMovieDetails}
                      onWatch={watchMovie}
                    />
                  ))}
                </PosterRow>
              </FadeInView>
            ) : null}
          </View>
        ) : idleLoading ? (
          <IdleSkeleton
            grid={grid}
            title={idleScope === "series" ? t.hubs.series.newSeries : t.search.newBooksRow}
            kind={idleScope === "books" ? "book" : "poster"}
          />
        ) : (
          /* The board's entrance fade, once per scope visit. */
          <FadeInView key={idleScope} duration={280} style={styles.idleSections}>
            {idleScope === "series" ? (
              newSeries.length > 0 ? (
                <View>
                  <SectionHeader
                    titleLines={2}
                    title={t.hubs.series.newSeries}
                    subtitle={t.search.sortRecentlyAdded}
                    onSeeAll={showAllSeries}
                    seeAllLabel={t.common.seeAll}
                    seeAllTone="text"
                  />
                  <PosterRow grid={grid}>
                    {newSeries.map((item) => (
                      <SeriesPosterCell key={item.id} series={item} width={grid.cellWidth} onPress={goToSeriesDetails} />
                    ))}
                  </PosterRow>
                </View>
              ) : (
                <ThemedText variant="body" color={theme.colors.textMuted} style={styles.idleNote}>
                  {t.hubs.series.noSeriesYet}
                </ThemedText>
              )
            ) : shelfBooks.length > 0 ? (
              <View>
                <SectionHeader
                  titleLines={2}
                  title={t.search.newBooksRow}
                  subtitle={t.library.newestFirst}
                  onSeeAll={showAllBooks}
                  seeAllLabel={t.common.seeAll}
                  seeAllTone="text"
                />
                <PosterRow grid={grid}>
                  {shelfBooks.map((book) => (
                    <ShelfBookCard key={book.id} book={book} width={grid.cellWidth} onOpen={goToBookDetails} />
                  ))}
                </PosterRow>
              </View>
            ) : (
              <ThemedText variant="body" color={theme.colors.textMuted} style={styles.idleNote}>
                {t.hubs.books.noBooksYet}
              </ThemedText>
            )}
          </FadeInView>
        )}
      </ScrollView>
      <GlassScrollFeed scrollRef={idleScrollRef} scrollY={glass.scrollY} />
    </>
  );

  return (
    <View ref={containerRef} style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        {!hasTerm ? (
          idleBody
        ) : resultsTab === "books" ? (
          /* First, before any query state is read: with the grid gated off, a
             guest's query never leaves `pending`, and the branches below would
             read that as "no results". Say what is actually true instead — the
             shelf needs an account. */
          !isAuthenticated ? (
            <View style={underBar}>
              <EmptyState
                title={t.search.booksSignedOutSearchTitle}
                message={t.search.booksSignedOutSearchBody}
                icon="lock-closed-outline"
              />
            </View>
          ) : booksQuery.isLoading ? (
            <ResultsSkeleton grid={grid} kind="book" pills={1} topPadding={glass.barHeight + bodyTop} />
          ) : booksFailed ? (
            <View style={underBar}>
              <EmptyState
                title={t.search.errorTitle}
                message={t.common.somethingWentWrong}
                icon="cloud-offline-outline"
                tone={theme.colors.danger}
                actionLabel={t.common.retry}
                onAction={() => booksQuery.refetch()}
              />
            </View>
          ) : books.length === 0 ? (
            /* The header rides above the empty state rather than being replaced
               by it: on this tab it carries the ONLY door to the authors list,
               and a term that matches no book is exactly when you might want to
               go looking by author instead. */
            <>
              <ScrollView
                ref={headerOnlyScrollRef}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={scrollBottom}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
              >
                {listHeader}
                <EmptyState
                  title={t.search.noResultsTitle}
                  message={t.search.noResultsBody.replace("{term}", committedTerm)}
                  icon="search-outline"
                />
              </ScrollView>
              <GlassScrollFeed scrollRef={headerOnlyScrollRef} scrollY={glass.scrollY} />
            </>
          ) : (
            <ResultsRegion termKey={`books:${committedTerm}`} stale={resultsStale}>
              {/* No `clip` here: a book card casts a real drop shadow that falls
                  OUTSIDE its own bounds, and Android's subview clipping shears it
                  off near the recycling boundary mid-fling. */}
              <ResultsGrid
                id="books"
                listRef={gridRef}
                data={books}
                columns={grid.columns}
                keyExtractor={bookKeyExtractor}
                header={listHeader}
                footer={listFooter}
                rowStyle={gridRowStyle}
                separator={GridRowGap}
                contentStyle={gridContentStyle}
                renderItem={renderBookItem}
                onEndReached={booksEndReached}
                batch={renderBatch}
              />
              <GlassScrollFeed scrollRef={gridRef} scrollY={glass.scrollY} />
            </ResultsRegion>
          )
        ) : resultsTab === "movies" ? (
          moviesQuery.isLoading ? (
            <ResultsSkeleton grid={grid} kind="poster" pills={showFilterRow ? 1 : 2} topPadding={glass.barHeight + bodyTop} />
          ) : moviesFailed ? (
            <View style={underBar}>
              <EmptyState
                title={t.search.errorTitle}
                message={t.common.somethingWentWrong}
                icon="cloud-offline-outline"
                tone={theme.colors.danger}
                actionLabel={t.common.retry}
                onAction={() => moviesQuery.refetch()}
              />
            </View>
          ) : movies.length === 0 ? (
            peopleRail ? (
              /* The term matched people but no titles: the faces ARE the result,
                 so show the header the grid would carry (People section, then
                 the honest "0 results" row) in place of the no-results block. */
              <>
                <ScrollView
                  ref={headerOnlyScrollRef}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={scrollBottom}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                >
                  {listHeader}
                </ScrollView>
                <GlassScrollFeed scrollRef={headerOnlyScrollRef} scrollY={glass.scrollY} />
              </>
            ) : (
              <View style={underBar}>
                <EmptyState {...emptyResultProps} icon="search-outline" />
              </View>
            )
          ) : (
            <ResultsRegion termKey={`movies:${committedTerm}`} stale={resultsStale}>
              <ResultsGrid
                id="movies"
                listRef={gridRef}
                data={movies}
                columns={grid.columns}
                keyExtractor={keyExtractor}
                header={listHeader}
                footer={listFooter}
                rowStyle={gridRowStyle}
                separator={GridRowGap}
                contentStyle={gridContentStyle}
                renderItem={renderMovieItem}
                onEndReached={moviesEndReached}
                refreshControl={moviesRefreshControl}
                batch={renderBatch}
                clip
              />
              <GlassScrollFeed scrollRef={gridRef} scrollY={glass.scrollY} />
            </ResultsRegion>
          )
        ) : seriesQuery.isLoading ? (
          <ResultsSkeleton grid={grid} kind="poster" pills={showFilterRow ? 1 : 2} topPadding={glass.barHeight + bodyTop} />
        ) : seriesFailed ? (
          <View style={underBar}>
            <EmptyState
              title={t.search.errorTitle}
              message={t.common.somethingWentWrong}
              icon="cloud-offline-outline"
              tone={theme.colors.danger}
              actionLabel={t.common.retry}
              onAction={() => seriesQuery.refetch()}
            />
          </View>
        ) : series.length === 0 ? (
          <View style={underBar}>
            <EmptyState {...emptyResultProps} icon="search-outline" />
          </View>
        ) : (
          <ResultsRegion termKey={`series:${committedTerm}`} stale={resultsStale}>
            <ResultsGrid
              id="series"
              listRef={gridRef}
              data={series}
              columns={grid.columns}
              keyExtractor={keyExtractor}
              header={listHeader}
              footer={listFooter}
              rowStyle={gridRowStyle}
              separator={GridRowGap}
              contentStyle={gridContentStyle}
              renderItem={renderSeriesItem}
              onEndReached={seriesEndReached}
              refreshControl={seriesRefreshControl}
              batch={renderBatch}
              clip
            />
            <GlassScrollFeed scrollRef={gridRef} scrollY={glass.scrollY} />
          </ResultsRegion>
        )}
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      {/* The Media tab's bar (the boards keep it on this page too), then the
          back button beside the field, its hint line, the scope pills and the
          filter row — floating over the page, with the glass behind it. */}
      <AppTopBar
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        heading={t.nav.media}
        trailing={<AppBarAction icon="search" selected onPress={focusField} accessibilityLabel={t.browse.searchA11y} />}
      >
        <View style={styles.fieldRow}>
          <AppBarAction
            icon="chevron-back"
            onPress={goBack}
            accessibilityLabel={backToMedia ? t.search.backToMedia : t.common.back}
          />
          <View style={styles.field}>
            <SearchField
              inputRef={inputRef}
              anchorRef={fieldRef}
              autoFocus
              onFocus={handleFieldFocus}
              onBlur={handleFieldBlur}
              value={searchText}
              onChangeText={handleChangeSearchText}
              onSubmit={commitSearch}
              onClear={clearSearch}
              placeholder={searchPlaceholder}
              accessibilityLabel={t.search.fieldLabel}
              clearAccessibilityLabel={t.search.clearField}
            />
          </View>
        </View>

        {/* One slot under the field, from the first character until the
            commit: the min-chars hint (a hint, not an error) or — once the
            term is long enough — the pending-search line, which is a BUTTON
            that commits. It outlives the panel (blur, dismissed keyboard,
            picked suggestion), so the keyboard's search key is never the only
            way left to commit. Mutually exclusive by construction; aligned
            with the field's glyph. */}
        {hintVisible ? (
          <View ref={hintRef} collapsable={false} style={styles.hintRow}>
            {isTooShort ? (
              <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
                {t.search.minChars.replace("{n}", String(SEARCH_MIN_LENGTH))}
              </ThemedText>
            ) : (
              <Pressable
                onPress={commitSearch}
                hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={pendingLabel}
                style={({ pressed }) => [styles.pending, pressed && styles.pressed]}
              >
                <ThemedText
                  variant="caption"
                  weight="bold"
                  color={theme.colors.link}
                  numberOfLines={1}
                  style={styles.pendingText}
                >
                  {pendingLabel}
                </ThemedText>
                <Ionicons name="arrow-forward" size={14} color={theme.colors.link} />
              </Pressable>
            )}
          </View>
        ) : null}

        {/* The pill strip is also the suggestion panel's anchor: the panel
            hangs under it, so the pills stay tappable while typing (on a short
            screen it hangs from the hint line or the field instead). */}
        <View
          ref={tabsRef}
          collapsable={false}
          onLayout={bumpAnchor}
          style={hintVisible ? styles.tabsAfterHint : styles.tabs}
        >
          <SearchTabs options={tabOptions} value={tab} onChange={handleTabChange} />
        </View>

        {/* The filter row: the Sort & filter pill (its count badge), then a
            chip per active value — each ✕ removes just that value — and
            Clear all. Part of the bar, so the glass and the page's top
            padding both include it. */}
        {showFilterRow ? (
          <View style={styles.filterRow}>
            <FilterRow count={activeFilterCount} chips={filterChips} onEdit={openFilters} onClear={clearTabFilters} />
          </View>
        ) : null}
      </AppTopBar>

      {/* LAST absolutely-positioned sibling of the root, deliberately: an
          absolute child contributes nothing to the flex layout above it, so
          every grid, header and pill keeps the exact position and size it had.
          Inside the app bar it would render but refuse taps on Android. */}
      <SearchSuggestions
        term={searchText}
        visible={suggestionsVisible}
        kind={suggestKind}
        anchorRef={tabsRef}
        fallbackAnchorRefs={fallbackAnchorRefs}
        anchorKey={anchorKey}
        containerRef={containerRef}
        onDismiss={dismissSuggestions}
        onSelectMovie={selectSuggestion}
        onSelectSeries={selectSeriesSuggestion}
        onSelectBook={selectBookSuggestion}
        onSeeAll={commitSearch}
      />

      {/* The Media page's Sort & filter sheet, over the same shared filters;
          its count includes the committed term. */}
      <SortFilterSheet
        visible={sheetOpen}
        onClose={closeSheet}
        kind={resultsTab === "series" ? "series" : "movies"}
        term={committedTerm}
        onOpenAllFilters={openAllFilters}
      />
    </View>
  );
}

/** Back button (6pt in + 44) + its 4pt gap + the field's own 18pt to its glyph — the board's 72. */
const HINT_INSET = 6 + theme.layout.minTouch + 4 + 18;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  fill: { flex: 1 },
  /** The board: the round back button 6pt from the edge, 4pt to the field, the field 16pt from the right; 8pt under the bar. */
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingLeft: 6,
    paddingRight: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
  },
  field: { flex: 1, minWidth: 0 },
  /**
   * The hint slot under the field — 32pt (a minimum, so 2× text grows it),
   * inset to line up with the field's search glyph.
   */
  hintRow: { minHeight: 32, justifyContent: "center", marginTop: 6, paddingLeft: HINT_INSET, paddingRight: 16 },
  pending: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%" },
  pendingText: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
  /** 12pt under the field (the idle board), 6pt under the hint line (the typing board). */
  tabs: { marginTop: 12 },
  tabsAfterHint: { marginTop: 6 },
  filterRow: { marginTop: 12 },
  /** The grid header's own bottom gap: count row → first row of posters. */
  listHeader: { paddingBottom: HEADER_TO_GRID },
  /** People sit 24pt above the count row. */
  headerSection: { marginBottom: theme.spacing.lg },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  gridRowGap: { height: 20 },
  posterRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: theme.layout.screenPadding },
  /** Before a search: 32pt between sections (the 24pt under the pills is `idleScrollContent`). */
  idleContent: { gap: theme.spacing.xl },
  idleSections: { gap: theme.spacing.xl },
  idleNote: { paddingHorizontal: theme.layout.screenPadding },
  idleState: { alignItems: "center", paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xl },
  idleRetry: { marginTop: theme.spacing.md, minWidth: 140 },
});

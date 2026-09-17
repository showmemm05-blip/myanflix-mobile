import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type TextInput,
} from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Chip } from "@/components/common/Chip";
import { MediaCard } from "@/components/common/MediaCard";
import { MovieRow } from "@/components/movie/MovieRow";
import { MediaRail } from "@/components/movie/MediaRail";
import { movieCardContent, seriesCardContent } from "@/components/movie/mediaItems";
import {
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
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
import { buildFilterPills } from "@/components/search/filterPills";
import { SearchField } from "@/components/search/SearchField";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";
import { SearchSuggestions, type SuggestKind } from "@/components/search/SearchSuggestions";
import { ResultsGrid } from "@/components/search/ResultsGrid";
import { ResultsRegion } from "@/components/search/ResultsRegion";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { useMovies, useMostPurchased, useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesList, useSeriesInfinite } from "@/hooks/useSeries";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useBooksInfinite, useBooksList } from "@/hooks/useBooks";
import { BookCard } from "@/components/books/BookCard";
import { BookRail } from "@/components/books/BookRail";
import { useAuthStore } from "@/store/authStore";
import type { Book } from "@/types/book";
import { SEARCH_MIN_LENGTH } from "@/hooks/useSearchTerm";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SearchStackParamList } from "@/navigation/types";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

type Props = NativeStackScreenProps<SearchStackParamList, "Search">;

type Tab = "all" | "movies" | "series" | "books" | "music";

/** How many past queries the in-memory recent list keeps. */
const RECENT_LIMIT = 6;
/** Shared empty list so the loading rails don't get a fresh array each render. */
const NO_MOVIES: Movie[] = [];
/** Both frontends page the filtered catalog with this (backend caps at 100). */
const PAGE_SIZE = 30;
/** How many books the All tab's shelf holds — the web's AllMediaView asks for the same 14. */
const BOOK_SHELF_LIMIT = 14;

/**
 * Module scope on purpose. It is handed to FlatList, whose cells are
 * PureComponents — an inline `(item) => item.id` extractor would be a fresh
 * identity on every keystroke and re-render every visible row for a change
 * that only touched the search field. (The row separator that used to sit
 * beside it moved into ResultsGrid, for the same reason and at module scope
 * there.)
 */
const keyExtractor = (item: { id: string }) => item.id;

export function SearchScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  // Results are READ, not scanned: the spacious density gives a phone two
  // columns instead of three, which roughly doubles a poster's area and leaves
  // room for the title, meta and genre lines under it.
  const grid = usePosterGrid("spacious");
  const [tab, setTab] = useState<Tab>(route.params?.initialTab ?? "all");
  /* ---- the two terms -------------------------------------------------------
   * `searchText` is what the FIELD shows — every keystroke. `committedTerm` is
   * what the GRID answers, and it only ever advances when the user commits:
   * the keyboard's search key, the suggestion panel's "See all results" row,
   * or a recent-search chip. Emptying the field is the one other transition,
   * and it resets rather than advances.
   *
   * WHY there is no debounce here, which is the part a future reader will want
   * to "fix": this screen deliberately does NOT use `useSearchTerm` (the shared
   * 400ms debounced hook that BooksCatalog still uses, and that this screen
   * used until now). The owner asked twice for the movies already on screen to
   * STAY on screen while they type — a debounce still swaps the whole grid out
   * from under them, just 400ms later. Typing must change the field and its
   * suggestion panel and nothing else, so the term feeding the queries is
   * frozen between commits. Re-wiring a debounced term into `moviesQuery` would
   * undo the entire point of this screen's behaviour.
   */
  const [searchText, setSearchText] = useState("");
  const [committedTerm, setCommittedTerm] = useState("");
  /** Typed, but still too short to search — a hint, not an error. */
  const trimmedText = searchText.trim();
  const isTooShort = trimmedText.length > 0 && trimmedText.length < SEARCH_MIN_LENGTH;
  /** Long enough to search, but not what the grid is showing — see the hint. */
  const isPendingSearch = trimmedText.length >= SEARCH_MIN_LENGTH && trimmedText !== committedTerm;
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

  // A term COMMITTED on the browse tab has to land somewhere it can be
  // answered. "All" is a rail of recommendations, not a result set, so the
  // moment a search is committed the selection moves to Movies — the tab the
  // placeholder has been promising all along ("Search movies…"). Keyed off the
  // committed term, not the typed text: off the typed text this would swap the
  // whole browse body mid-keystroke, which is the single largest violation of
  // "leave the movies that are already shown alone".
  useEffect(() => {
    if (tab === "all" && committedTerm) setTab("movies");
  }, [tab, committedTerm]);

  // Relevance is only honest while a term is actually in the query — the server
  // would fall back to recentlyAdded anyway, so the state follows the COMMITTED
  // term (what the query holds), not the box, to keep the sheet and the chips
  // row truthful.
  useEffect(() => {
    if (committedTerm) return;
    setFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_MOVIE_SORT } : f));
    setSeriesFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_SERIES_SORT } : f));
  }, [committedTerm]);

  // The browse rails on the "all" tab — deliberately unfiltered.
  // Two rails, two server sorts — client-sorting one 50-row page was only
  // honest while the catalog fit in 50 rows.
  const railsQuery = useMovies({ limit: 12, sort: "rating" });
  const latestRailQuery = useMovies({ limit: 12, sort: "recentlyAdded" });
  const seriesRailQuery = useSeriesList({ limit: 100 });
  const popularQuery = useMostPurchased();

  /**
   * The books shelf on the same tab. Newest-first is simply what /books
   * returns, so there is nothing to sort — the first row IS "new on the shelf".
   *
   * The library is MEMBERS-ONLY (/books 401s a guest while movies and series
   * read publicly), so the query is gated on the session exactly as the web's
   * AllMediaView gates its own: a signed-out viewer never asks, and the shelf
   * simply is not there rather than failing. Cold start needs no extra care —
   * the store starts signed-out, and `enabled` flips on its own once the boot
   * token check resolves a user.
   */
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const bookShelfQuery = useBooksList({ limit: BOOK_SHELF_LIMIT }, { enabled: isAuthenticated });
  const shelfBooks = useMemo(() => bookShelfQuery.data?.items ?? [], [bookShelfQuery.data]);

  // The filtered catalog queries. Every filter travels to the backend — there
  // is ZERO client-side catalog filtering or sorting on this screen anymore.
  // `committedTerm`, never `searchText`: a keystroke must not change the key.
  const moviesQuery = useMoviesInfinite({
    search: committedTerm || undefined,
    ...movieFiltersToQuery(filters),
    limit: PAGE_SIZE,
  });
  const seriesQuery = useSeriesInfinite({
    search: committedTerm || undefined,
    ...seriesFiltersToQuery(seriesFilters),
    limit: PAGE_SIZE,
  });
  const movies = useMemo(() => moviesQuery.data?.pages.flatMap((page) => page.items) ?? [], [moviesQuery.data]);
  const series = useMemo(() => seriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [seriesQuery.data]);

  // Books live inline on this tab exactly like movies and series do — the
  // segment used to be a "go to the catalog" door, which read as broken
  // ("why are books not rendering here?"). Same search term, same grid.
  // PAGE_SIZE, like the two grids above: `limit` is part of the cache key, so
  // the odd 24 this grid used to spell gave it a second copy of the list
  // BooksCatalog already holds at 30 — the same rows fetched twice and kept in
  // memory twice for anyone who visits both with the same term.
  // Gated exactly like the shelf above, and for the same reason: /books 401s a
  // guest, so an ungated grid turned "you need an account" into the error
  // EmptyState that blames the connection. The signed-out branch below says the
  // honest thing instead. `isAuthenticated` flips on its own once the boot
  // token check resolves, so a returning user needs no extra nudge.
  const booksQuery = useBooksInfinite(
    { search: committedTerm || undefined, limit: PAGE_SIZE },
    { enabled: isAuthenticated },
  );
  const books = useMemo(
    () => booksQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [booksQuery.data],
  );
  // Shared by the books grid and the All tab's shelf, and stable so neither
  // one's memoized cells are rebuilt by a keystroke in the field above them.
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

  const recommendedMovies = useMemo(
    () => (railsQuery.data?.items ?? []),
    [railsQuery.data],
  );
  const latestMovies = useMemo(
    () => (latestRailQuery.data?.items ?? []),
    [latestRailQuery.data],
  );
  const popularMovies = useMemo(() => popularQuery.data ?? [], [popularQuery.data]);
  const activeFilterCount = tab === "series" ? countSeriesFilters(seriesFilters) : countMovieFilters(filters);

  // Stable identities so the browse rails' memoized cards survive a keystroke
  // in the search field or a filter change.
  //
  // These push onto THIS stack (MovieDetails/SeriesDetails are registered in
  // every stack that can open one — see SearchStackNavigator). They
  // used to hop to the Home tab, which is why back landed on Home instead of
  // the results. `navigate` is correct here and pushes, because the target
  // name is never the focused route (Search is): in react-navigation 7 a
  // NAVIGATE only reuses a route when its name matches the CURRENT one.
  const goToMovieDetails = useCallback(
    (movie: Movie) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const goToSeriesDetails = useCallback(
    (series: SeriesListItem) => navigation.navigate("SeriesDetails", { seriesId: series.id }),
    [navigation],
  );
  /**
   * The shelf's "See all" — the books CATEGORY PAGE on mobile is the Books
   * segment of this same screen, so this switches the tab rather than pushing
   * BooksCatalog, which would stack a near-duplicate grid on the navigator.
   */
  const showAllBooks = useCallback(() => setTab("books"), []);

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

  // The row renderers must not close over either term — that would give them a
  // new identity on every keystroke and re-render every visible FlatList cell
  // (RN's CellRenderer is a PureComponent, so a stable renderItem is what keeps
  // the rows still). Read the value at press time from a ref instead.
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
   * A card in the grid belongs to the COMMITTED term — the grid is frozen while
   * the user types, so opening a poster with "spid" half-typed in the box must
   * not file "spid" as a past search that was never run (tapping that chip
   * later would then commit it). A suggestion row is the opposite case: the
   * panel genuinely did search the live text, so that path records it.
   */
  const rememberCommittedSearch = useCallback(() => rememberSearch(committedTermRef.current), [rememberSearch]);
  const rememberTypedSearch = useCallback(() => rememberSearch(searchTextRef.current), [rememberSearch]);

  const inputRef = useRef<TextInput | null>(null);

  /* ---- the suggestion panel ----------------------------------------------
   * One panel per catalogue — movies, series and books each list their own
   * rows — and each with its own state, its own 150ms debounce and its own
   * query key, never the grid's. The panel READS `searchText` (already screen state
   * driving the controlled field, so it costs no extra render per keystroke)
   * and it is now the live half of the screen: while the grid holds still, the
   * panel is what answers each keystroke. Its only reach into the grid is the
   * "See all results" footer, which runs the same `commitSearch` the keyboard's
   * search key does — deliberately, because with the grid frozen the panel
   * would otherwise be a dead end on its own.
   */
  const containerRef = useRef<View | null>(null);
  const fieldRef = useRef<View | null>(null);
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
    // and the browse list comes back — one re-query, at the end, never one per
    // keystroke.
    if (next.trim().length === 0) setCommittedTerm("");
  }, []);

  /**
   * The commit. Every route to full results runs exactly this: the keyboard's
   * search key, the panel's "See all results" row, and (with its own term) a
   * recent-search chip. Below SEARCH_MIN_LENGTH it is a deliberate no-op — the
   * min-chars hint under the field already says why nothing happened.
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

  /** The X button — both terms in one handler, so the browse list comes back. */
  const clearSearch = useCallback(() => {
    setSearchText("");
    setCommittedTerm("");
  }, []);

  /**
   * A recent chip. A past query is already a whole question, so the tap IS the
   * search — it commits immediately and does NOT hand the caret back. Focusing
   * was the right call while a debounce was going to fire anyway ("let them
   * correct it first"); now it would pop the suggestion panel open directly on
   * top of the results the tap just produced.
   */
  const replayRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      setSearchText(term);
      setCommittedTerm(trimmed);
      rememberSearch(trimmed);
      // Same reason `commitSearch` does it: the panel must not pop open over
      // the results this tap just produced.
      setSuggestDismissed(true);
      inputRef.current?.blur();
    },
    [rememberSearch],
  );

  // Android's hardware back hides the keyboard WITHOUT blurring the field,
  // which would leave the panel floating over a keyboardless screen. Blur as
  // well as close, so the field's state matches what the platform already did
  // and the next tap on it fires onFocus again. The grids' own
  // keyboardDismissMode="on-drag" arrives here too, which is why dragging the
  // results closes the panel for free.
  useEffect(() => {
    if (!fieldFocused) return;
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      setFieldFocused(false);
      inputRef.current?.blur();
    });
    return () => subscription.remove();
  }, [fieldFocused]);

  /**
   * Which catalogue the panel lists — every tab that HAS one gets its own rows,
   * so a series row opens a series and a book row opens a book. "All" borrows
   * the movies panel because that is where its commits land: the effect above
   * switches it to Movies the moment a search is committed, which on that tab
   * is the only way results ever arrive. Music has no catalogue to list (and no
   * search field either), so it gets no panel at all.
   *
   * A SIGNED-OUT viewer gets no books panel either, for the same reason the
   * grid and the shelf are gated: its rows come from /books, which 401s a
   * guest. Without this the "sign in to read books" state below would sit under
   * a panel still firing the very request the gate exists to avoid — and a 401
   * forces a logout, which now empties the query cache (see useAuth's
   * subscribeToUnauthorized), so a guest's keystroke would blow away the movie
   * rails. `null` is the state Music already uses, so the panel simply stays
   * closed rather than unmounting mid-animation.
   */
  const suggestKind: SuggestKind | null =
    tab === "series"
      ? "series"
      : tab === "books"
        ? isAuthenticated
          ? "books"
          : null
        : tab === "music"
          ? null
          : "movies";

  /**
   * The field names what it will actually search. Derived from the same tab
   * expression as the panel above, so the two can never promise different
   * things — "Search movies…" over a list of books was the old reading.
   */
  const searchPlaceholder =
    tab === "series"
      ? t.search.placeholderSeries
      : tab === "books"
        ? t.search.placeholderBooks
        : t.search.placeholderMovies;

  /**
   * It reads the LIVE text, on purpose: the panel is the half of the screen
   * that answers every keystroke while the grid holds still.
   */
  const suggestionsVisible =
    fieldFocused &&
    !suggestDismissed &&
    suggestKind !== null &&
    searchText.trim().length >= SEARCH_MIN_LENGTH;

  /**
   * What every suggestion row does before it navigates, spelled once so the
   * three kinds cannot drift apart. Close first, from the row's own press —
   * never waiting on a blur that may not come. Then the screen's EXISTING
   * recents path: the LIVE text, because the panel really did search it, so it
   * earns its place in recents even though the grid was never asked to run it.
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

  /**
   * No longer asymmetric: BookDetails, MovieDetails and SeriesDetails all live
   * on THIS stack now, so every suggestion pushes inside the Media tab and back
   * returns here. The call is the same one `renderBookItem` already makes for a
   * grid card.
   */
  const selectBookSuggestion = useCallback(
    (book: Book) => {
      dismissAndRemember();
      navigation.navigate("BookDetails", { bookId: book.id });
    },
    [dismissAndRemember, navigation],
  );

  const cellWidth = grid.cellWidth;
  // The gap is the grid's, not a constant — the spacious density widens it,
  // and the row wrapper has to agree with the cell width it was measured from.
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);
  /** Roughly three rows — fewer columns means fewer cells per screenful. */
  const renderBatch = grid.columns * 3;
  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MediaCard
        // The genre line is opt-in per surface: only these cells are wide
        // enough for a third line without crowding the title.
        {...movieCardContent(item, { showGenre: true })}
        width={cellWidth}
        onPress={() => {
          rememberCommittedSearch();
          goToMovieDetails(item);
        }}
      />
    ),
    [cellWidth, rememberCommittedSearch, goToMovieDetails],
  );

  const renderSeriesItem = useCallback(
    ({ item }: ListRenderItemInfo<SeriesListItem>) => (
      <MediaCard
        {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
        width={cellWidth}
        onPress={() => {
          rememberCommittedSearch();
          goToSeriesDetails(item);
        }}
      />
    ),
    [t, cellWidth, rememberCommittedSearch, goToSeriesDetails],
  );

  /**
   * The last two grid props that were still inline. `FlatList` is a
   * PureComponent, so a fresh arrow or a fresh `<RefreshControl>` element is
   * enough to force a whole VirtualizedList pass on every keystroke — which is
   * exactly what the committed-term model above exists to prevent. Every
   * dependency here is stable: query-core binds `refetch` and `fetchNextPage`
   * in the observer constructor, so these hold across renders.
   */
  const moviesEndReached = useCallback(() => {
    if (moviesQuery.hasNextPage && !moviesQuery.isFetchingNextPage) moviesQuery.fetchNextPage();
  }, [moviesQuery.hasNextPage, moviesQuery.isFetchingNextPage, moviesQuery.fetchNextPage]);

  const moviesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={moviesQuery.isRefetching && !moviesQuery.isFetchingNextPage}
        onRefresh={() => moviesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [moviesQuery.isRefetching, moviesQuery.isFetchingNextPage, moviesQuery.refetch],
  );

  const seriesEndReached = useCallback(() => {
    if (seriesQuery.hasNextPage && !seriesQuery.isFetchingNextPage) seriesQuery.fetchNextPage();
  }, [seriesQuery.hasNextPage, seriesQuery.isFetchingNextPage, seriesQuery.fetchNextPage]);

  const seriesRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={seriesQuery.isRefetching && !seriesQuery.isFetchingNextPage}
        onRefresh={() => seriesQuery.refetch()}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
        progressBackgroundColor={theme.colors.surface}
      />
    ),
    [seriesQuery.isRefetching, seriesQuery.isFetchingNextPage, seriesQuery.refetch],
  );

  const booksEndReached = useCallback(() => {
    if (booksQuery.hasNextPage && !booksQuery.isFetchingNextPage) booksQuery.fetchNextPage();
  }, [booksQuery.hasNextPage, booksQuery.isFetchingNextPage, booksQuery.fetchNextPage]);

  /**
   * Hoisted for the same reason `listHeader` is: this strip sits ABOVE the
   * field and none of it can change while the user types, so a keystroke must
   * not rebuild it. With five options it takes the scrolling-chip branch, so
   * the rebuild costs a ScrollView plus five Pressables, glyphs and labels.
   */
  const tabOptions = useMemo(
    () => [
      { value: "all", label: t.search.all, icon: "apps-outline" as const },
      { value: "movies", label: t.search.movies, icon: "film-outline" as const },
      { value: "series", label: t.search.series, icon: "tv-outline" as const },
      { value: "books", label: t.search.books, icon: "book-outline" as const },
      { value: "music", label: t.search.music, icon: "musical-notes-outline" as const },
    ],
    [t],
  );
  const handleTabChange = useCallback((v: string) => setTab(v as Tab), []);

  /** The tabs whose body IS a result grid — they own the filter sheet. */
  // Books ride here too: the books grid is filtered by the same search term
  // server-side, so hiding the field on that tab turned a term typed on
  // Movies into an INVISIBLE filter with no way to see or clear it.
  const isSearchTab = tab === "movies" || tab === "series" || tab === "books";
  /**
   * The field, however, belongs to the SCREEN, not to one segment. This tab
   * opens on "all" (browse rails), so gating the field on `isSearchTab` meant
   * the first thing a user saw after tapping Search was a screen with no
   * search box at all — they had to discover the Movies segment before the
   * field existed. Music is the one exception: nothing there can be searched
   * yet, so offering a field would be a promise the tab cannot keep.
   */
  const showSearchField = tab !== "music";
  /**
   * Per-tab query facts, read off the one query that owns the visible grid.
   * Spelled out per tab rather than through a `tab === "series" ? a : b` union
   * so each value keeps its own concrete type — three infinite queries over
   * three different row types do not narrow cleanly as one.
   */
  const resultTotal =
    tab === "series"
      ? seriesQuery.data?.pages[0]?.total
      : tab === "books"
        ? booksQuery.data?.pages[0]?.total
        : moviesQuery.data?.pages[0]?.total;
  const resultsFetching =
    tab === "series" ? seriesQuery.isFetching : tab === "books" ? booksQuery.isFetching : moviesQuery.isFetching;
  /**
   * The grid on screen is the PREVIOUS term's, held over by keepPreviousData.
   * It stays interactive but fades, so the fresh heading above it is never
   * read as a caption for stale cards.
   */
  const resultsStale =
    tab === "series"
      ? seriesQuery.isPlaceholderData
      : tab === "books"
        ? booksQuery.isPlaceholderData
        : moviesQuery.isPlaceholderData;
  const isFetchingNextPage =
    tab === "series"
      ? seriesQuery.isFetchingNextPage
      : tab === "books"
        ? booksQuery.isFetchingNextPage
        : moviesQuery.isFetchingNextPage;
  /**
   * The loading affordance. The grid is only ever fetching after a commit now,
   * so the glyph spins for a real request and nothing else — there is no
   * debounce window left for it to cover. While the user is merely typing, the
   * suggestion panel's own skeleton rows, right under the field, are what says
   * "working".
   */
  const isSearching = isSearchTab && resultsFetching;
  /**
   * The recents block lives inside `listHeader`, so gating it on the typed text
   * would shift every poster below it up on the FIRST keystroke. Gated on the
   * committed term instead, which is what makes the entire list — header
   * included — a pure function of committed state while typing.
   */
  const showRecents = isSearchTab && committedTerm.length === 0 && recentSearches.length > 0;
  const resetFilters = useCallback(() => {
    setFilters(createMovieFilters());
    setSeriesFilters(createSeriesFilters());
  }, []);

  /**
   * The match count, already phrased per tab — or null while the number in hand
   * describes the PREVIOUS query (held-over placeholder pages), because a wrong
   * count is worse than none. It always describes the COMMITTED term, which is
   * exactly what the heading above it names and the grid below it holds; typing
   * cannot make it wrong, because typing does not change any of the three.
   */
  const countLabel = useMemo(() => {
    if (resultTotal === undefined || resultsStale) return null;
    const n = String(resultTotal);
    if (tab === "series")
      return resultTotal === 1 ? t.search.resultsFoundSeriesOne : t.search.resultsFoundSeries.replace("{n}", n);
    if (tab === "books")
      return resultTotal === 1 ? t.search.resultsFoundBooksOne : t.search.resultsFoundBooks.replace("{n}", n);
    return resultTotal === 1 ? t.search.resultsFoundMoviesOne : t.search.resultsFoundMovies.replace("{n}", n);
  }, [resultTotal, resultsStale, tab, t]);

  /**
   * What the grid below is answering — the COMMITTED term, or just the tab
   * while idle. Naming the term is what keeps the screen honest while the user
   * types something else: the band never claims to be showing a search that has
   * not been run. This heading IS the "sign of why" for held results.
   */
  const resultsHeading = committedTerm
    ? t.search.resultsForTerm.replace("{term}", committedTerm)
    : tab === "series"
      ? t.search.series
      : tab === "books"
        ? t.search.books
        : t.search.movies;

  /**
   * Shared by all three no-results branches so they read as one state. It
   * quotes the COMMITTED term — the one that was actually searched — never the
   * text still sitting in the box.
   */
  const emptyResultProps = useMemo(() => {
    if (committedTerm) {
      return {
        title: t.search.noResultsTitle,
        message: t.search.noResultsBody.replace("{term}", committedTerm),
        actionLabel: activeFilterCount > 0 ? t.common.reset : undefined,
        onAction: activeFilterCount > 0 ? resetFilters : undefined,
      };
    }
    if (activeFilterCount > 0) {
      return {
        title: t.search.noResultsTitle,
        message: t.search.noResultsFiltersBody,
        actionLabel: t.common.reset,
        onAction: resetFilters,
      };
    }
    return { title: t.search.idleTitle, message: t.search.idleBody, actionLabel: undefined, onAction: undefined };
  }, [committedTerm, activeFilterCount, t, resetFilters]);

  /**
   * One pill per active value. The builder itself lives next to
   * SearchFilterSheet, which owns the rest of this vocabulary; here it is
   * still a pure function of filter state, so the useMemo stays. The two
   * label helpers went with it and are module-level pure functions now, which
   * is why they are no longer deps.
   */
  const filterPills = useMemo(
    () => buildFilterPills({ tab, filters, seriesFilters, setFilters, setSeriesFilters, t }),
    [tab, filters, seriesFilters, t],
  );

  /**
   * Memoized so a keystroke re-renders NOTHING below the field — an inline
   * element here would be a fresh identity every render, which re-renders the
   * whole header row for a change that only touched the search box. Every value
   * it reads is committed state, so it genuinely cannot change while typing.
   */
  const listHeader = useMemo(
    () => (
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
              <Chip key={term} label={term} icon="time-outline" onPress={() => replayRecent(term)} />
            ))}
          </View>
        </View>
      ) : null}

      {/* The owner's "Results (125 Movies Found)" band, sitting between the
          field and the first row of cards. Unconditional now — an unfiltered
          catalogue has a total too, and hiding it made the grid look like it
          started mid-list. */}
      <SearchResultsHeader kicker={t.search.resultsTitle.toUpperCase()} title={resultsHeading} countLabel={countLabel} />
    </View>
    ),
    [showRecents, recentSearches, resultsHeading, countLabel, replayRecent, t],
  );

  /** Spinner while the next page streams in under the user's thumb. */
  const listFooter = isFetchingNextPage ? (
    <View style={styles.footerLoading}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  ) : null;

  return (
    <View ref={containerRef} style={styles.container}>
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
          {showSearchField && (
            /* Field and hint are one group so the hint hugs the field, and the
               block's own gap only ever separates the field from the tabs. */
            <View style={styles.fieldGroup}>
              <SearchField
                inputRef={inputRef}
                anchorRef={fieldRef}
                onFocus={handleFieldFocus}
                onBlur={handleFieldBlur}
                value={searchText}
                onChangeText={handleChangeSearchText}
                onSubmit={commitSearch}
                onClear={clearSearch}
                loading={isSearching}
                placeholder={searchPlaceholder}
                accessibilityLabel={t.search.fieldLabel}
                clearAccessibilityLabel={t.search.clearField}
              />
              {/* A hint, not an error — the unfiltered view stays on screen. */}
              {isTooShort && (
                <ThemedText variant="caption" style={styles.hint}>
                  {t.search.minChars.replace("{n}", String(SEARCH_MIN_LENGTH))}
                </ThemedText>
              )}
              {/* The other half of the honesty story (the heading is the first):
                  the box holds a question the grid has not been asked yet, and
                  this names the action that asks it. Deliberately NOT gated on
                  the panel being visible — gating it that way would grow the
                  header block, and so push the grid down, at the moment the
                  keyboard is dismissed. It shares the min-chars hint's slot and
                  is mutually exclusive with it by construction (that one needs
                  < SEARCH_MIN_LENGTH), so the slot is simply occupied from the
                  first qualifying character until the commit — strictly fewer
                  layout shifts than before. One line, always, so a long term or
                  a wide Burmese line cannot wrap and reintroduce a shift.

                  It is a BUTTON, not a caption, because the panel's own "See
                  all results" row is not always there to be tapped: the panel
                  closes on a blur, on a dismissed keyboard and on a picked
                  suggestion, and this line outlives all three. Without it the
                  keyboard's search key would be the only way to commit in those
                  states. The line already named the action; making it perform
                  it costs no layout at all — hitSlop buys the touch target
                  instead of height. */}
              {isPendingSearch && (
                <Pressable
                  onPress={commitSearch}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={t.search.pendingSearch.replace("{term}", trimmedText)}
                >
                  <ThemedText
                    variant="caption"
                    weight="semibold"
                    color={theme.colors.primary}
                    numberOfLines={1}
                    style={styles.hint}
                  >
                    {t.search.pendingSearch.replace("{term}", trimmedText)}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}

          <SegmentedControl
            options={tabOptions}
            value={tab}
            onChange={handleTabChange}
            // This strip shares the header with the search field; everywhere
            // else the control owns its own band and keeps the taller rung.
            compact
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.browseContent}
            // The field lives above these rails now, so even the loading
            // state has to put the keyboard away when it is dragged.
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <MovieRow title={t.search.recommendedRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
            <MovieRow title={t.search.popularRow} movies={NO_MOVIES} onPressMovie={goToMovieDetails} loading />
          </ScrollView>
        ) : railsQuery.isError ? (
          <EmptyState message={t.common.somethingWentWrong} icon="cloud-offline-outline" tone={theme.colors.danger} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.browseContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={
                  railsQuery.isRefetching ||
                  popularQuery.isRefetching ||
                  seriesRailQuery.isRefetching ||
                  latestRailQuery.isRefetching ||
                  bookShelfQuery.isRefetching
                }
                onRefresh={() => {
                  railsQuery.refetch();
                  popularQuery.refetch();
                  seriesRailQuery.refetch();
                  // Was missing: this tab has always rendered a "Latest"
                  // rail that pull-to-refresh quietly left alone, so the one
                  // shelf whose whole point is newness was the one shelf that
                  // never updated.
                  latestRailQuery.refetch();
                  // The guard is load-bearing, not caution: refetch() ignores
                  // `enabled`, so calling it unconditionally would make a
                  // guest's pull-to-refresh fire the very /books request the
                  // gate exists to avoid.
                  if (isAuthenticated) bookShelfQuery.refetch();
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
              {/* Books come after every video shelf, which is the web's fixed
                  one-medium-then-the-next order (movies → books → music) — the
                  four rails above are all video, so this is the only position
                  that does not split them in two. */}
              <BookRail
                title={t.search.newBooksRow}
                eyebrow={t.search.books}
                icon="library-outline"
                books={shelfBooks}
                onPressBook={goToBookDetails}
                onSeeAll={showAllBooks}
                seeAllLabel={t.common.seeAll}
                loading={isAuthenticated && bookShelfQuery.isLoading}
              />
            </View>
          </ScrollView>
        )
      ) : tab === "books" ? (
        /* First, before any query state is read: with the grid gated off, a
           guest's query never leaves `pending`, and the branches below would
           read that as "no results" and offer a search that cannot run. Say
           what is actually true instead — the shelf needs an account. */
        !isAuthenticated ? (
          <EmptyState
            title={t.search.booksSignedOutTitle}
            message={t.search.booksSignedOutBody}
            icon="lock-closed-outline"
          />
        ) : booksQuery.isLoading ? (
          <ResultsSkeleton grid={grid} />
        ) : booksQuery.isError ? (
          <EmptyState
            title={t.search.errorTitle}
            message={t.common.somethingWentWrong}
            icon="cloud-offline-outline"
            tone={theme.colors.danger}
            actionLabel={t.common.retry}
            onAction={() => booksQuery.refetch()}
          />
        ) : books.length === 0 ? (
          <EmptyState
            title={committedTerm ? t.search.noResultsTitle : t.search.idleTitle}
            message={committedTerm ? t.search.noResultsBody.replace("{term}", committedTerm) : t.search.booksReady}
            icon={committedTerm ? "search-outline" : "book-outline"}
          />
        ) : (
          <ResultsRegion termKey={`books:${committedTerm}`} stale={resultsStale}>
            {/* No `clip` here, unlike the movie and series grids below: a book
                card casts a real drop shadow that falls OUTSIDE its own
                bounds, and Android's subview clipping shears it off for cells
                near the recycling boundary mid-fling. The books rail leaves
                the flag off for the same reason. Leaving the prop off entirely
                is what this grid has always done — passing `false` would be a
                different thing, see ResultsGrid. */}
            <ResultsGrid
              id="books"
              data={books}
              columns={grid.columns}
              keyExtractor={bookKeyExtractor}
              header={listHeader}
              footer={listFooter}
              rowStyle={gridRowStyle}
              renderItem={renderBookItem}
              onEndReached={booksEndReached}
              batch={renderBatch}
            />
          </ResultsRegion>
        )
      ) : tab === "music" ? (
        <EmptyState message={t.search.musicComingSoon} icon="musical-notes-outline" />
      ) : tab === "movies" ? (
        moviesQuery.isLoading ? (
          <ResultsSkeleton grid={grid} />
        ) : moviesQuery.isError ? (
          <EmptyState
            title={t.search.errorTitle}
            message={t.common.somethingWentWrong}
            icon="cloud-offline-outline"
            tone={theme.colors.danger}
            actionLabel={t.common.retry}
            onAction={() => moviesQuery.refetch()}
          />
        ) : movies.length === 0 ? (
          <EmptyState {...emptyResultProps} icon={committedTerm ? "search-outline" : "film-outline"} />
        ) : (
          <ResultsRegion termKey={`movies:${committedTerm}`} stale={resultsStale}>
            <ResultsGrid
              id="movies"
              data={movies}
              columns={grid.columns}
              keyExtractor={keyExtractor}
              header={listHeader}
              footer={listFooter}
              rowStyle={gridRowStyle}
              renderItem={renderMovieItem}
              onEndReached={moviesEndReached}
              refreshControl={moviesRefreshControl}
              batch={renderBatch}
              clip
            />
          </ResultsRegion>
        )
      ) : seriesQuery.isLoading ? (
        <ResultsSkeleton grid={grid} />
      ) : seriesQuery.isError ? (
        <EmptyState
          title={t.search.errorTitle}
          message={t.common.somethingWentWrong}
          icon="cloud-offline-outline"
          tone={theme.colors.danger}
          actionLabel={t.common.retry}
          onAction={() => seriesQuery.refetch()}
        />
      ) : series.length === 0 ? (
        <EmptyState {...emptyResultProps} icon={committedTerm ? "search-outline" : "tv-outline"} />
      ) : (
        <ResultsRegion termKey={`series:${committedTerm}`} stale={resultsStale}>
          <ResultsGrid
            id="series"
            data={series}
            columns={grid.columns}
            keyExtractor={keyExtractor}
            header={listHeader}
            footer={listFooter}
            rowStyle={gridRowStyle}
            renderItem={renderSeriesItem}
            onEndReached={seriesEndReached}
            refreshControl={seriesRefreshControl}
            batch={renderBatch}
            clip
          />
        </ResultsRegion>
      )}

      {/* LAST absolutely-positioned sibling of the root, deliberately: an
          absolute child contributes nothing to the flex layout above it, so
          every grid, header and tab keeps the exact position and size it had.
          Inside the app bar it would render but refuse taps on Android. */}
      <SearchSuggestions
        term={searchText}
        visible={suggestionsVisible}
        kind={suggestKind}
        anchorRef={fieldRef}
        containerRef={containerRef}
        onSelectMovie={selectSuggestion}
        onSelectSeries={selectSeriesSuggestion}
        onSelectBook={selectBookSuggestion}
        onSeeAll={commitSearch}
      />

      <SearchFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        tab={tab === "series" ? "series" : "movies"}
        filters={filters}
        onChangeFilters={setFilters}
        seriesFilters={seriesFilters}
        onChangeSeriesFilters={setSeriesFilters}
        total={tab === "series" ? seriesQuery.data?.pages[0]?.total : moviesQuery.data?.pages[0]?.total}
        isFetching={tab === "series" ? seriesQuery.isFetching : moviesQuery.isFetching}
        hasSearchTerm={Boolean(committedTerm)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBlock: {
    paddingHorizontal: theme.layout.screenPadding,
    // The field's focus ring is drawn 3pt outside its own border, so the block
    // needs that much slack above it or the ring lands under the app bar.
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    // sm, not md: with the field and the strip both shorter, 16pt between them
    // read as a gap rather than as one header. The two belong together.
    gap: theme.spacing.sm,
  },
  fieldGroup: { gap: theme.spacing.xs },
  hint: { paddingHorizontal: theme.spacing.md },
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
  /** The results band brings its own padding, so this one only stacks. */
  listHeader: { gap: theme.spacing.md },
  recents: { gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding },
  recentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearRecent: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingLeft: theme.spacing.sm },
  recentRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  browseContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  rows: { gap: theme.spacing.lg },
  footerLoading: { paddingVertical: theme.spacing.md, alignItems: "center" },
});

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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { EmptyState } from "@/components/ui/EmptyState";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Chip } from "@/components/common/Chip";
import {
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  countMovieFilters,
  countSeriesFilters,
  movieFiltersToQuery,
  seriesFiltersToQuery,
  summarizeMovieFilters,
  summarizeSeriesFilters,
} from "@/components/search/filters";
import { FilterSummary } from "@/components/search/FilterBar";
import { ListCardSkeleton } from "@/components/search/ListCard";
import { MovieListCard } from "@/components/search/MovieListCard";
import { SeriesListCard } from "@/components/search/SeriesListCard";
import { PeopleRail } from "@/components/search/PeopleRail";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { SearchField } from "@/components/search/SearchField";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";
import { SearchSuggestions, type SuggestKind } from "@/components/search/SearchSuggestions";
import { SearchTabs } from "@/components/search/SearchTabs";
import { ResultsGrid } from "@/components/search/ResultsGrid";
import { ResultsList } from "@/components/search/ResultsList";
import { ResultsRegion } from "@/components/search/ResultsRegion";
import { ResultsListSkeleton, ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { useMovies, useMoviesInfinite } from "@/hooks/useMovies";
import { useSeriesList, useSeriesInfinite } from "@/hooks/useSeries";
import { useActorSearch } from "@/hooks/useActors";
import { usePosterGrid } from "@/hooks/usePosterGrid";
import { useBooksInfinite, useBooksList } from "@/hooks/useBooks";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { BookCard } from "@/components/books/BookCard";
import { BookRail } from "@/components/books/BookRail";
import { useAuthStore } from "@/store/authStore";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";
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
 * Composite, like MovieDetails: "Watch Now" on a list card plays directly, and
 * Player lives on the ROOT stack above the tabs — `getParent()?.navigate` only
 * type-checks once the tab and root param lists are in the picture.
 */
type Props = CompositeScreenProps<
  NativeStackScreenProps<SearchStackParamList, "Search">,
  CompositeScreenProps<BottomTabScreenProps<MainTabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

type Tab = "all" | "movies" | "series" | "books" | "music";

/** How many past queries the in-memory recent list keeps. */
const RECENT_LIMIT = 6;
/** Both frontends page the filtered catalog with this (backend caps at 100). */
const PAGE_SIZE = 30;
/**
 * How much of each medium the All tab shows before "See all" — three, the
 * owner's number: the sections are a taste, and each tab is the full list.
 * The books shelf asks the server for exactly that many rather than slicing
 * a bigger page.
 */
const ALL_MOVIE_COUNT = 3;
const ALL_SERIES_COUNT = 3;
const BOOK_SHELF_LIMIT = 3;
/** Loading rows under the All tab's first section while the rails are still on the wire. */
const ALL_SKELETON_ROWS = 3;
/**
 * Module scope on purpose. It is handed to FlatList, whose cells are
 * PureComponents — an inline `(item) => item.id` extractor would be a fresh
 * identity on every keystroke and re-render every visible row for a change
 * that only touched the search field. (The row separator that used to sit
 * beside it moved into ResultsGrid, for the same reason and at module scope
 * there.)
 */
const keyExtractor = (item: { id: string }) => item.id;

/*
 * WHAT RENDERS WHERE — the screen's map, so a reviewer can check it:
 *
 *   AppTopBar   search field (every tab but Music) + hints, then the tab strip.
 *   Under tabs  Movies/Series only: the filter summary line + "Clear", while
 *               any filter is active. Nothing on All, Books, Music.
 *   All         People rail (term matches actors) → Movies section (3) →
 *               Series section (3) → books shelf; each "See all" is the tab.
 *   Movies      list header = [People rail | recents] + count row with the
 *               ONE Filter button → infinite list of MovieListCards. No
 *               movies but matching people → the header alone, in a scroll.
 *   Series      list header = [recents] + count row with the Filter button →
 *               infinite list of SeriesListCards.
 *   Books       count row WITHOUT a filter button → the cover grid (members).
 *   Music       coming-soon state.
 *
 * The count row on Movies, Series and Books also carries a names button, and
 * it is CONTEXTUAL: People → ActorsList on Movies and Series, Authors →
 * AuthorsList on Books, because a book has an author rather than a cast. Both
 * lists are their own page now, not a sixth tab (six overflowed the strip).
 * All lays itself out with no count row, so the button is not on that tab;
 * the owner accepted that.
 *
 * Every filter lives in searchFiltersStore (the SearchFilters page writes it,
 * this screen sends it) — nothing here holds filter state of its own.
 */
export function SearchScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  // The BOOKS grid only now — movies and series are one-per-row list cards.
  // Results are READ, not scanned: the spacious density gives a phone two
  // columns instead of three, which roughly doubles a cover's area and leaves
  // room for the title and author under it.
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
  /** Long enough to search, but not what the list is showing — see the hint. */
  const isPendingSearch = trimmedText.length >= SEARCH_MIN_LENGTH && trimmedText !== committedTerm;
  // THE canonical filter state — the shared store, one object per tab. The
  // SearchFilters page writes it; this screen only reads it (and resets it),
  // and the server does all filtering and sorting.
  const movieFilters = useSearchFiltersStore((state) => state.movieFilters);
  const seriesFilters = useSearchFiltersStore((state) => state.seriesFilters);
  const setMovieFilters = useSearchFiltersStore((state) => state.setMovieFilters);
  const setSeriesFilters = useSearchFiltersStore((state) => state.setSeriesFilters);
  const resetMovieFilters = useSearchFiltersStore((state) => state.resetMovieFilters);
  const resetSeriesFilters = useSearchFiltersStore((state) => state.resetSeriesFilters);
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
  // term (what the query holds), not the box, to keep the filters page and the
  // summary line truthful. Written to the store, the same place the page does.
  useEffect(() => {
    if (committedTerm) return;
    setMovieFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_MOVIE_SORT } : f));
    setSeriesFilters((f) => (f.sort === "relevance" ? { ...f, sort: DEFAULT_SERIES_SORT } : f));
  }, [committedTerm, setMovieFilters, setSeriesFilters]);

  // The browse rails on the "all" tab — deliberately unfiltered.
  // Top-rated first: the three the Movies section shows are the best-rated
  // three, which is the taste "See all" then widens.
  const railsQuery = useMovies({ limit: ALL_MOVIE_COUNT, sort: "rating" });
  const seriesRailQuery = useSeriesList({ limit: ALL_SERIES_COUNT });

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

  /**
   * What "Watch Now" on a list card may do — the same `hasAccess` rule
   * MovieDetails applies to its own CTA, read once here for every card.
   * Gated on the session for the reason the hook documents: the endpoint 401s
   * a guest, and a guest is simply not subscribed.
   */
  const subscriptionQuery = useSubscriptionStatus({ enabled: isAuthenticated });
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;

  // The filtered catalog queries. Every filter travels to the backend — there
  // is ZERO client-side catalog filtering or sorting on this screen anymore.
  // `committedTerm`, never `searchText`: a keystroke must not change the key.
  const moviesQuery = useMoviesInfinite({
    search: committedTerm || undefined,
    ...movieFiltersToQuery(movieFilters),
    limit: PAGE_SIZE,
  });
  const seriesQuery = useSeriesInfinite({
    search: committedTerm || undefined,
    ...seriesFiltersToQuery(seriesFilters),
    limit: PAGE_SIZE,
  });
  const movies = useMemo(() => moviesQuery.data?.pages.flatMap((page) => page.items) ?? [], [moviesQuery.data]);
  const series = useMemo(() => seriesQuery.data?.pages.flatMap((page) => page.items) ?? [], [seriesQuery.data]);

  /**
   * The people the term matches — the rail of faces above the results. The
   * hook fires from one character (names are short), so the screen applies
   * the catalogue's own minimum here: below it the query is disabled AND the
   * list is forced empty, because keepPreviousData would otherwise hold the
   * last term's faces over an empty field. Committed term only, like the
   * lists — typing must not move the rail either.
   */
  // Gated on the tab as well as the term: the rail renders ONLY on All and
  // Movies, so asking /actors from Series or Books was a request whose answer
  // nothing could display.
  const railVisible = tab === "all" || tab === "movies";
  const peopleTerm =
    railVisible && committedTerm.length >= SEARCH_MIN_LENGTH ? committedTerm : "";
  const actorsQuery = useActorSearch(peopleTerm);
  const actors = useMemo(
    () => (peopleTerm ? (actorsQuery.data?.items ?? []) : []),
    [peopleTerm, actorsQuery.data],
  );

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

  /**
   * The All tab's Movies section — the top-rated rail's first few, as list
   * cards. Sliced in the memo so the array identity holds across keystrokes.
   */
  const allTabMovies = useMemo(
    () => (railsQuery.data?.items ?? []).slice(0, ALL_MOVIE_COUNT),
    [railsQuery.data],
  );
  /** The visible tab's badge number — books and the others have no filters, so 0 there. */
  const activeFilterCount =
    tab === "series" ? countSeriesFilters(seriesFilters) : tab === "movies" ? countMovieFilters(movieFilters) : 0;
  /** The line under the tabs — null (no row at all) when nothing is active. */
  const filterSummary =
    tab === "series"
      ? summarizeSeriesFilters(t, seriesFilters)
      : tab === "movies"
        ? summarizeMovieFilters(t, movieFilters)
        : null;

  // Stable identities so the browse rails' memoized cards survive a keystroke
  // in the search field or a filter change.
  //
  // These push onto THIS stack (MovieDetails/SeriesDetails/ActorDetails are
  // registered in every stack that can open one — see SearchStackNavigator).
  // They used to hop to the Home tab, which is why back landed on Home instead
  // of the results. `navigate` is correct here and pushes, because the target
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
  const goToActorDetails = useCallback(
    (actor: ActorListItem) => navigation.navigate("ActorDetails", { actorId: actor.id }),
    [navigation],
  );
  /**
   * The ONE filter control's destination: the full-page editor, told which
   * tab's filters to edit and the committed term (its result count runs the
   * same query as the list, and "Relevance" is only offered with a term). It
   * reads and writes the store directly — nothing comes back through params.
   */
  const openFilters = useCallback(
    () => navigation.navigate("SearchFilters", { tab: tab === "series" ? "series" : "movies", term: committedTerm }),
    [navigation, tab, committedTerm],
  );
  /**
   * The names button's two destinations — the standalone actors list, where
   * the faces went when the sixth tab was dropped, and its books twin. Neither
   * takes params: both screens carry their own search field, and this screen's
   * term is a question about the catalogue, not about the people behind it, so
   * handing it over would put a filter on the list nobody asked for.
   */
  const openPeople = useCallback(() => navigation.navigate("ActorsList"), [navigation]);
  const openAuthors = useCallback(() => navigation.navigate("AuthorsList"), [navigation]);
  /** The summary line's "Clear" and the no-results reset — the VISIBLE tab's filters only. */
  const clearTabFilters = useCallback(() => {
    if (tab === "series") resetSeriesFilters();
    else resetMovieFilters();
  }, [tab, resetMovieFilters, resetSeriesFilters]);
  /**
   * "Watch Now" on a list card. Plays directly when the viewer has access —
   * Player is on the root stack, above the tabs, which is why this goes
   * through `getParent()` exactly as MovieDetails' own CTA does — and
   * otherwise opens MovieDetails, where the subscribe CTA and the locked note
   * live. The card never learns about subscriptions; this is the one place
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
   * The All tab's "See all" links — every category page on mobile is a
   * segment of this same screen, so these switch the tab rather than pushing
   * a near-duplicate list onto the navigator.
   */
  const showAllMovies = useCallback(() => setTab("movies"), []);
  const showAllSeries = useCallback(() => setTab("series"), []);
  const showAllBooks = useCallback(() => setTab("books"), []);

  /**
   * The All tab's Series section — the first few of the series rail's rows as
   * list cards. Sliced here rather than at render so the array identity holds
   * across keystrokes and the memoized cards stay still.
   */
  const allTabSeries = useMemo(
    () => (seriesRailQuery.data?.items ?? []).slice(0, ALL_SERIES_COUNT),
    [seriesRailQuery.data],
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

  // The gap is the grid's, not a constant — the spacious density widens it,
  // and the row wrapper has to agree with the cell width it was measured from.
  const gridRowStyle = useMemo(() => [styles.gridRow, { gap: grid.gap }], [grid.gap]);
  /** Roughly three rows of the books grid — fewer columns means fewer cells per screenful. */
  const renderBatch = grid.columns * 3;
  /** A screenful and a bit of ~180pt list rows. */
  const listBatch = 6;

  /**
   * Opening a row from the results files the COMMITTED term as a recent (see
   * `rememberCommittedSearch`); the All tab's cards below use the bare
   * `goToMovieDetails`, because nothing there was searched. Stable, so the
   * memoized cards do not re-render on a keystroke.
   */
  const openMovieResult = useCallback(
    (movie: Movie) => {
      rememberCommittedSearch();
      goToMovieDetails(movie);
    },
    [rememberCommittedSearch, goToMovieDetails],
  );
  const openSeriesResult = useCallback(
    (series: SeriesListItem) => {
      rememberCommittedSearch();
      goToSeriesDetails(series);
    },
    [rememberCommittedSearch, goToSeriesDetails],
  );
  const renderMovieItem = useCallback(
    ({ item }: ListRenderItemInfo<Movie>) => (
      <MovieListCard movie={item} onPress={openMovieResult} onWatch={watchMovie} />
    ),
    [openMovieResult, watchMovie],
  );

  const renderSeriesItem = useCallback(
    ({ item }: ListRenderItemInfo<SeriesListItem>) => <SeriesListCard series={item} onPress={openSeriesResult} />,
    [openSeriesResult],
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
   * Hoisted for the same reason `listHeader` is: this strip sits right UNDER
   * the field and none of it can change while the user types, so a keystroke
   * must not rebuild it — a rebuild costs a ScrollView plus five Pressables,
   * glyphs and labels.
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

  /** The tabs whose body IS a result list (books: a grid). */
  // Books ride here too: the books grid is filtered by the same search term
  // server-side, so hiding the field on that tab turned a term typed on
  // Movies into an INVISIBLE filter with no way to see or clear it.
  // It gates the two things that belong to a FILTERED catalogue list — the
  // recents block and (with resultsFetching) the field's spinner.
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
    tab === "series"
      ? seriesQuery.isFetching
      : tab === "books"
        ? booksQuery.isFetching
        : moviesQuery.isFetching;
  /**
   * The list on screen is the PREVIOUS term's, held over by keepPreviousData.
   * It stays interactive but fades, so the fresh count row above it is never
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

  /**
   * The match count, already phrased per tab — or null while the number in hand
   * describes the PREVIOUS query (held-over placeholder pages), because a wrong
   * count is worse than none. It always describes the COMMITTED term, which is
   * exactly what the count row names and the list below it holds; typing
   * cannot make it wrong, because typing does not change any of the three.
   */
  /*
   * With a term committed the line NAMES it — "12 results for “inception”".
   * That is what keeps the screen honest while the user types something
   * else: the header never claims to be showing a search that has not been
   * run, and it is the "sign of why" for held results. Idle, it is just the
   * tab's noun and its total ("12 movies").
   */
  const countLabel = useMemo(() => {
    if (resultTotal === undefined || resultsStale) return null;
    const n = String(resultTotal);
    if (committedTerm) {
      const template = resultTotal === 1 ? t.search.resultsForTermCountOne : t.search.resultsForTermCount;
      return template.replace("{n}", n).replace("{term}", committedTerm);
    }
    if (tab === "series") return resultTotal === 1 ? t.search.countSeriesOne : t.search.countSeries.replace("{n}", n);
    if (tab === "books") return resultTotal === 1 ? t.search.countBooksOne : t.search.countBooks.replace("{n}", n);
    return resultTotal === 1 ? t.search.countMoviesOne : t.search.countMovies.replace("{n}", n);
  }, [resultTotal, resultsStale, tab, committedTerm, t]);

  /**
   * The header's ONE filter control — on the two tabs that have filters. Books
   * has none, so no button there: this is the same expression that keeps
   * `activeFilterCount` at 0 and `filterSummary` null for it. Committed state
   * only, like everything else in the header.
   */
  const filterControl = useMemo(
    () => (tab === "movies" || tab === "series" ? { count: activeFilterCount, onPress: openFilters } : undefined),
    [tab, activeFilterCount, openFilters],
  );

  /**
   * The header's OTHER button, and the one thing about it that is contextual:
   * Movies and Series are cast, so it says People and opens the actors list;
   * Books are written, so it says Authors and opens the authors list. Same
   * pill, same place — only the word, the glyph and the destination move, which
   * is what makes "who is behind this?" one habit across the three tabs.
   *
   * All has no results header at all (its own layout), and Music has no
   * catalogue, so neither is spelled here: the header simply isn't rendered
   * there.
   */
  const peopleControl = useMemo(
    () =>
      tab === "books"
        ? { label: t.search.authors, icon: "create-outline" as const, onPress: openAuthors }
        : { label: t.search.people, icon: "people-outline" as const, onPress: openPeople },
    [tab, t, openAuthors, openPeople],
  );

  /**
   * Shared by the no-results branches so they read as one state. It quotes
   * the COMMITTED term — the one that was actually searched — never the text
   * still sitting in the box. The reset clears the visible tab's filters.
   */
  const emptyResultProps = useMemo(() => {
    if (committedTerm) {
      return {
        title: t.search.noResultsTitle,
        message: t.search.noResultsBody.replace("{term}", committedTerm),
        actionLabel: activeFilterCount > 0 ? t.common.reset : undefined,
        onAction: activeFilterCount > 0 ? clearTabFilters : undefined,
      };
    }
    if (activeFilterCount > 0) {
      return {
        title: t.search.noResultsTitle,
        message: t.search.noResultsFiltersBody,
        actionLabel: t.common.reset,
        onAction: clearTabFilters,
      };
    }
    return { title: t.search.idleTitle, message: t.search.idleBody, actionLabel: undefined, onAction: undefined };
  }, [committedTerm, activeFilterCount, t, clearTabFilters]);

  /**
   * The faces row, or nothing. One element, memoized, used in two places: the
   * All tab's first section and the Movies tab's list header (and that tab's
   * "people but no movies" fallback). Committed state only, so a keystroke
   * cannot rebuild it.
   */
  const peopleRail = useMemo(
    () => (actors.length > 0 ? <PeopleRail actors={actors} onPress={goToActorDetails} /> : null),
    [actors, goToActorDetails],
  );

  /**
   * Memoized so a keystroke re-renders NOTHING below the field — an inline
   * element here would be a fresh identity every render, which re-renders the
   * whole header row for a change that only touched the search box. Every value
   * it reads is committed state, so it genuinely cannot change while typing.
   *
   * Order: people (Movies tab, with a term) — recents (no term) — the count
   * row. The first two are mutually exclusive by construction, so the header
   * never stacks both.
   */
  const listHeader = useMemo(
    () => (
    <View style={styles.listHeader}>
      {tab === "movies" ? peopleRail : null}

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

      {/* The count row between the field and the first card, with the names
          and Filter buttons on its right. Unconditional — an unfiltered
          catalogue has a total too, and hiding it made the list look like it
          started mid-way. Books has no filter control, so the names pill —
          "Authors" there — is the only button on that tab; it still shows. */}
      <SearchResultsHeader countLabel={countLabel} filter={filterControl} people={peopleControl} />
    </View>
    ),
    [tab, peopleRail, showRecents, recentSearches, countLabel, filterControl, peopleControl, replayRecent, t],
  );

  /** Spinner while the next page streams in under the user's thumb. */
  const listFooter = isFetchingNextPage ? (
    <View style={styles.footerLoading}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  ) : null;

  return (
    <View ref={containerRef} style={styles.container}>
      {/* The wordmark bar stays (the owner wants the nav bar on every tab);
          under it the field, edge to edge. No title — the field IS this
          screen's subject and every point above it is a point the results do
          not get. The filter control moved down into the results header, so
          nothing shares this row with the field any more. */}
      <AppTopBar>
        <View style={styles.headerBlock}>
          {showSearchField && (
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
          )}

          {showSearchField && (
            <>
              {/* A hint, not an error — the unfiltered view stays on screen. */}
              {isTooShort && (
                <ThemedText variant="caption" style={styles.hint}>
                  {t.search.minChars.replace("{n}", String(SEARCH_MIN_LENGTH))}
                </ThemedText>
              )}
              {/* The other half of the honesty story (the count row is the first):
                  the box holds a question the list has not been asked yet, and
                  this names the action that asks it. Deliberately NOT gated on
                  the panel being visible — gating it that way would grow the
                  header block, and so push the list down, at the moment the
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
            </>
          )}
        </View>

        {/* The owner's tab strip — icons and an underline, in place of the
            pill segments the rest of the app uses. "All" stays: the owner
            wants movies, series AND books on one tab. */}
        <SearchTabs options={tabOptions} value={tab} onChange={handleTabChange} />
      </AppTopBar>

      {/* ONE caption under the tabs while any filter is active on the visible
          tab — what the filters page applied, and a Clear beside it. Null
          summary = no row at all, so an unfiltered list starts right under
          the strip. Only Movies and Series have filters; the others never
          produce a summary. */}
      {filterSummary && <FilterSummary text={filterSummary} onClear={clearTabFilters} />}

      {tab === "all" ? (
        railsQuery.isLoading ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.browseContent}
            // The field lives above these sections, so even the loading
            // state has to put the keyboard away when it is dragged.
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <SectionHeader title={t.search.movies} icon="film-outline" />
              <View style={styles.sectionList}>
                {Array.from({ length: ALL_SKELETON_ROWS }).map((_, index) => (
                  <ListCardSkeleton key={index} />
                ))}
              </View>
            </View>
            {/* The Series section's own rows, so the loading screen has the
                same two blocks the loaded one opens with. */}
            <View style={styles.section}>
              <SectionHeader title={t.search.series} icon="tv-outline" />
              <View style={styles.sectionList}>
                {Array.from({ length: ALL_SKELETON_ROWS }).map((_, index) => (
                  <ListCardSkeleton key={index} />
                ))}
              </View>
            </View>
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
                refreshing={railsQuery.isRefetching || seriesRailQuery.isRefetching || bookShelfQuery.isRefetching}
                onRefresh={() => {
                  railsQuery.refetch();
                  seriesRailQuery.refetch();
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
              {/* People first, when the committed term matches any — the
                  one section on this tab that answers the term (the rails
                  below are unfiltered recommendations). */}
              {peopleRail}

              {/* Movies and series as the SAME list cards the tabs show, so
                  All reads as one screen rather than a different app; each
                  "See all" is the tab, which is the full list. */}
              {allTabMovies.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={t.search.movies}
                    icon="film-outline"
                    onSeeAll={showAllMovies}
                    seeAllLabel={t.common.seeAll}
                  />
                  <View style={styles.sectionList}>
                    {allTabMovies.map((movie) => (
                      <MovieListCard key={movie.id} movie={movie} onPress={goToMovieDetails} onWatch={watchMovie} />
                    ))}
                  </View>
                </View>
              )}

              {/* The series rail is its own request and used to land AFTER the
                  movie cards — the section simply appeared late, pushing the
                  rails below it down. Skeleton rows the height of a list card
                  hold its place until it does; the same count the Movies
                  section's loading state uses. */}
              {seriesRailQuery.isLoading ? (
                <View style={styles.section}>
                  <SectionHeader title={t.search.series} icon="tv-outline" />
                  <View style={styles.sectionList}>
                    {Array.from({ length: ALL_SKELETON_ROWS }).map((_, index) => (
                      <ListCardSkeleton key={index} />
                    ))}
                  </View>
                </View>
              ) : allTabSeries.length > 0 && (
                <View style={styles.section}>
                  <SectionHeader
                    title={t.search.series}
                    icon="tv-outline"
                    onSeeAll={showAllSeries}
                    seeAllLabel={t.common.seeAll}
                  />
                  <View style={styles.sectionList}>
                    {allTabSeries.map((series) => (
                      <SeriesListCard key={series.id} series={series} onPress={goToSeriesDetails} />
                    ))}
                  </View>
                </View>
              )}

              {/* Books last: the web's fixed one-medium-then-the-next order
                  (movies → series → books). The Popular and Latest poster
                  rails that used to sit here are gone — three movies is the
                  owner's cap for this tab, and each tab is the full list. */}
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
          /* The header rides above the empty state rather than being replaced
             by it. On this tab it carries the ONLY door to the authors list,
             and a term that matches no book is exactly when you might want to
             go looking by author instead — dropping the row there left the
             feature unreachable until the search was cleared. */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.headerOverEmpty}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {listHeader}
            <EmptyState
              title={committedTerm ? t.search.noResultsTitle : t.search.idleTitle}
              message={committedTerm ? t.search.noResultsBody.replace("{term}", committedTerm) : t.search.booksReady}
              icon={committedTerm ? "search-outline" : "book-outline"}
            />
          </ScrollView>
        ) : (
          <ResultsRegion termKey={`books:${committedTerm}`} stale={resultsStale}>
            {/* No `clip` here, unlike the movie and series lists below: a book
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
          <ResultsListSkeleton />
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
          peopleRail ? (
            /* The term matched people but no titles: the faces ARE the
               result, so show the same header the list would carry (rail,
               then the honest "0 results" row with its filter button) in
               place of the no-results block. */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.peopleOnly}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              {listHeader}
            </ScrollView>
          ) : (
            <EmptyState {...emptyResultProps} icon={committedTerm ? "search-outline" : "film-outline"} />
          )
        ) : (
          <ResultsRegion termKey={`movies:${committedTerm}`} stale={resultsStale}>
            <ResultsList
              id="movies"
              data={movies}
              keyExtractor={keyExtractor}
              header={listHeader}
              footer={listFooter}
              renderItem={renderMovieItem}
              onEndReached={moviesEndReached}
              refreshControl={moviesRefreshControl}
              batch={listBatch}
              clip
            />
          </ResultsRegion>
        )
      ) : seriesQuery.isLoading ? (
        <ResultsListSkeleton />
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
          <ResultsList
            id="series"
            data={series}
            keyExtractor={keyExtractor}
            header={listHeader}
            footer={listFooter}
            renderItem={renderSeriesItem}
            onEndReached={seriesEndReached}
            refreshControl={seriesRefreshControl}
            batch={listBatch}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  /**
   * The field's block, edge to edge: the same padding both sides now that no
   * filter disc shares the row. The field's focus ring is drawn 3pt outside
   * its own border, so the block needs that much slack above it or the ring
   * lands under the status bar.
   */
  headerBlock: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  /** The hints sit under the field's own inner text, so they read as its caption. */
  hint: { paddingHorizontal: theme.spacing.md },
  /** The results row brings its own padding, so this one only stacks. */
  listHeader: { gap: theme.spacing.md },
  recents: { gap: theme.spacing.sm, paddingHorizontal: theme.layout.screenPadding },
  recentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearRecent: { minHeight: theme.layout.minTouch, justifyContent: "center", paddingLeft: theme.spacing.sm },
  recentRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  gridRow: { paddingHorizontal: theme.layout.screenPadding },
  browseContent: { paddingTop: theme.spacing.md, paddingBottom: theme.layout.tabBarClearance },
  /** The people-only fallback matches the list's own inset, so the header sits where it would in the list. */
  peopleOnly: { paddingTop: theme.spacing.sm, paddingBottom: theme.layout.tabBarClearance },
  /** Same inset as peopleOnly: the header sits where the list would put it. */
  headerOverEmpty: { paddingTop: theme.spacing.sm, paddingBottom: theme.layout.tabBarClearance },
  rows: { gap: theme.spacing.lg },
  /** An All-tab section: SectionHeader (which insets itself) over a padded stack of list cards. */
  section: { gap: theme.spacing.xs },
  sectionList: { paddingHorizontal: theme.layout.screenPadding, gap: theme.spacing.sm + 2 },
  footerLoading: { paddingVertical: theme.spacing.md, alignItems: "center" },
});

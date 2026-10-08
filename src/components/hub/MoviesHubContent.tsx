import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { FadeInView } from "@/components/ui/FadeInView";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { MoviePosterCell, PosterCellSkeleton } from "@/components/search/PosterCell";
import { SortFilterSheet } from "@/components/search/SortFilterSheet";
import {
  DEFAULT_MOVIE_SORT,
  clearMovieRefinements,
  countMovieRefinements,
  countMovieSelection,
  createMovieFilters,
  movieFilterChips,
  movieFiltersToQuery,
  selectionLabel,
  sortChoiceLabel,
  type MovieFilters,
} from "@/components/search/filters";
import { HubHero, type HubHeroSlide } from "@/components/hub/HubHero";
import { HubRow, type HubRowItem, type HubRowVariant } from "@/components/hub/HubRow";
import { HubAllGrid } from "@/components/hub/HubAllGrid";
import { HubBrowseList } from "@/components/hub/HubBrowseList";
import { MediaResultsHeader } from "@/components/hub/MediaResultsHeader";
import { HubError, HubHeroSkeleton, HubSkeleton } from "@/components/hub/HubStates";
import { HUB_SECTION_GAP, useHubChromeHeight } from "@/components/hub/hubLayout";
import { featureNewest } from "@/components/hub/hubFeatured";
import type { HubScroll } from "@/components/hub/useHubScroll";
import type { MediaResults } from "@/components/hub/useMediaResults";
import { useMediaTabNavigation } from "@/components/hub/mediaTabNavigation";
import { BROWSE_STALE_TIME_MS, useMovieFacets, useMovies, useMoviesInfinite } from "@/hooks/useMovies";
import { useCategories } from "@/hooks/useCategories";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { hasAccess } from "@/utils/access";
import { formatDuration } from "@/utils/format";
import { theme } from "@/theme";
import type { Movie, MovieQuery } from "@/types/movie";

interface Props {
  /**
   * The Movies chip is on screen and the Media tab's root is focused. The
   * hub stays mounted while another chip shows (or a screen is pushed over
   * it) — so it keeps its data — and only its hero's pager holds still.
   */
  active: boolean;
  /** Owned by the Media screen, which fades its bar in from it (useHubScroll). */
  scroll: HubScroll;
  /** Browse or results, and the filters the results list with (useMovieResults, owned by the Media screen). */
  results: MediaResults<MovieFilters>;
}

/** The story pager's five titles. */
const HERO_COUNT = 5;
/** The browse shelves' and newest list's freshness window (see CatalogListOptions). */
const BROWSE_OPTIONS = { staleTime: BROWSE_STALE_TIME_MS } as const;
/** Every shelf shows ten. */
const ROW_LIMIT = 10;
/** How many genre shelves and category shelves browse offers (most titles first). */
const GENRE_SHELVES = 10;
const CATEGORY_SHELVES = 6;
/**
 * The hero and "Recently added" read ONE request: the first page of the
 * newest movies, spelled exactly as the unfiltered results view (the
 * server's default sort, so no `sort` is sent) — "Recently added → See all"
 * opens on the very same cache entry.
 */
const NEWEST_QUERY = { limit: LIST_PAGE_SIZE } as const;

/** A browse shelf: its query, its look, and what its "See all" opens. */
type MovieShelf =
  | {
      key: string;
      kind: "query";
      title: string;
      subtitle?: string;
      variant: Extract<HubRowVariant, "poster" | "ranked">;
      query: MovieQuery;
      /** Each card shows its ★ rating (Top rated — whose query already leaves unrated titles out). */
      showRating?: boolean;
      /** The quiet line under each card. */
      meta: (movie: Movie) => HubRowItem["meta"];
      /** The results view's filters for "See all". */
      seeAll: Partial<MovieFilters>;
    }
  | { key: "recent"; kind: "recent" };

const yearOf = (movie: Movie) => (movie.releaseYear > 0 ? movie.releaseYear : null);

/** Genres and categories, alternating two genres to one category, the leftovers after. */
function interleave(genres: MovieShelf[], categories: MovieShelf[]): MovieShelf[] {
  const out: MovieShelf[] = [];
  let next = 0;
  genres.forEach((shelf, index) => {
    out.push(shelf);
    if (index % 2 === 1 && next < categories.length) out.push(categories[next++]);
  });
  while (next < categories.length) out.push(categories[next++]);
  return out;
}

/**
 * The results view's heading: the category, the genre(s), or — for the four
 * sorts that are shelves of their own — the sort, under the very name its
 * chip and the sheet give it.
 */
function resultsTitle(t: TranslationShape, f: MovieFilters, categoryName: string | null): string {
  const picked = selectionLabel(f.genres, f.categoryId ? (categoryName ?? t.browse.categoryOverline) : null);
  if (picked) return picked;
  switch (f.sort) {
    case "trending":
    case "mostViewed":
    case "newest":
    case "rating":
      return sortChoiceLabel(t, f.sort, "movies");
    default:
      return f.freeOnly && f.sort === DEFAULT_MOVIE_SORT ? t.hub.freeToWatch : t.hub.allMovies;
  }
}

/**
 * The Movies hub, as the body of the Media tab's Movies chip — Netflix's
 * model: browse → pick a category or genre → see its titles → scroll, and
 * more load by themselves.
 *
 * BROWSE (no genre picked): the hero — the five newest movies, those with
 * art first (there is no featured flag) — then shelves: Trending now (most
 * viewed among last year's and this year's releases), Popular (most viewed,
 * ranked), New releases (release year), Top rated (rated titles only),
 * Recently added, Free to watch, then the genres (GET /movies/facets) and
 * the admin categories (GET /categories), each asking for its titles as it
 * scrolls into view. Every "See all" opens the RESULTS view.
 *
 * RESULTS (a genre or category from the Categories overlay, a shelf's See
 * all, or any active filter): that genre's hero when it has titles, the
 * heading, the count, the filter row — "Sort & filter", a removable chip
 * per refinement, Clear all — and a 3-column grid that pages by itself,
 * keeping what is loaded while the next page comes (skeleton cells), never
 * asking for a page twice, an inline Retry on a failed page. A sort or
 * filter change keeps the old titles on screen, dimmed, until the new ones
 * land; a new genre cross-fades in from the top.
 */
export const MoviesHubContent = memo(function MoviesHubContent({ active, scroll, results }: Props) {
  const { t } = useLanguage();
  const navigation = useMediaTabNavigation();
  const queryClient = useQueryClient();
  const chromeHeight = useHubChromeHeight();

  // A guest has no subscription to ask about — and /subscriptions/me 401s a
  // guest into the logout path (useSubscriptionStatus explains), so only ask
  // when signed in. Without an answer (a guest, or a failed request) a
  // premium title shows Subscribe.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const subscriptionQuery = useSubscriptionStatus({ enabled: isAuthenticated });
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  // Signed in, answer still on its way: a premium title could go either way.
  const subscriptionPending = isAuthenticated && subscriptionQuery.isPending;
  const savedIds = useWatchlist().data;
  // `mutate` is bound once per observer, so this holds its identity.
  const toggleSaved = useToggleWatchlist().mutate;

  /* ---- navigation ---- */
  const openMovie = useCallback(
    (movie: Pick<Movie, "id">) => navigation.navigate("MovieDetails", { movieId: movie.id }),
    [navigation],
  );
  const playMovie = useCallback(
    (movie: Pick<Movie, "id">) => navigation.navigate("Player", { movieId: movie.id }),
    [navigation],
  );
  const openSubscribe = useCallback(() => navigation.navigate("Subscribe"), [navigation]);
  /**
   * The grid's play disc — the Media tab's rule: plays when the viewer has
   * access, otherwise the movie's page (where Subscribe and the locked note live).
   */
  const watchMovie = useCallback(
    (movie: Movie) => (hasAccess(movie.accessType, isSubscribed) ? playMovie(movie) : openMovie(movie)),
    [isSubscribed, playMovie, openMovie],
  );

  /* ---- the shared data ---- */
  const { filters, showResults } = results;
  // Browse rows change a few times a day: a 5-minute window keeps "back to
  // the app" from re-asking every loaded page (pull-to-refresh still does).
  const newestQuery = useMoviesInfinite(NEWEST_QUERY, BROWSE_OPTIONS);
  // Page one only: React Query keeps this page's identity while the same
  // cache entry pages further, so the hero and the shelf do not rebuild.
  const newestPage = newestQuery.data?.pages[0];
  const facetsQuery = useMovieFacets();
  const categoriesQuery = useCategories();

  /* ---- the hero slides (browse: the newest; results: the genre's newest) ---- */
  const buildSlides = useCallback(
    (movies: readonly Movie[]): HubHeroSlide[] =>
      featureNewest(movies, (movie) => !!(movie.posterUrl ?? movie.coverUrl), HERO_COUNT).map((movie) => {
        const isNew = isRecentlyAdded(movie.createdAt);
        // While a signed-in viewer's subscription is still on its way, a
        // premium title gets neither the gold Subscribe (wrong for a
        // subscriber) nor the player: a plain Play to the movie's page,
        // which decides for itself — as the Series hub does.
        const accessPending = movie.accessType !== "FREE" && subscriptionPending;
        const canWatch = !accessPending && hasAccess(movie.accessType, isSubscribed);
        const locked = !accessPending && !canWatch;
        const action = locked ? t.series.subscribeToWatch : t.player.play;
        return {
          key: movie.id,
          title: movie.title,
          // The stage is portrait: the poster first, the cover if that is all there is.
          imageUrl: movie.posterUrl ?? movie.coverUrl,
          isNew,
          accessType: movie.accessType,
          kicker: isNew ? t.browse.recentlyAdded : t.hub.featured,
          rating: movie.rating > 0 ? movie.rating : null,
          meta: [yearOf(movie), formatDuration(movie.duration), movie.genre || null],
          blurb: movie.description || null,
          primary: {
            kind: locked ? "subscribe" : "play",
            label: action,
            onPress: canWatch ? () => playMovie(movie) : locked ? openSubscribe : () => openMovie(movie),
            accessibilityLabel: t.hub.actionTitleA11y.replace("{action}", action).replace("{title}", movie.title),
          },
          secondary: {
            label: t.hub.myList,
            toggled: !!savedIds?.includes(movie.id),
            onPress: () => toggleSaved(movie.id),
          },
          info: {
            icon: "information-circle-outline",
            onPress: () => openMovie(movie),
            accessibilityLabel: t.hub.moreAbout.replace("{title}", movie.title),
          },
        };
      }),
    [isSubscribed, subscriptionPending, savedIds, t, playMovie, openSubscribe, openMovie, toggleSaved],
  );
  const browseSlides = useMemo(() => buildSlides(newestPage?.items ?? []), [buildSlides, newestPage]);
  const heroEmpty = useMemo(
    () => ({ title: t.hub.emptyMoviesTitle, message: t.hub.emptyMoviesBody, seed: "movies" }),
    [t],
  );

  /* ================================================================== */
  /* BROWSE                                                              */
  /* ================================================================== */

  const thisYear = new Date().getFullYear();
  const shelves = useMemo<MovieShelf[]>(() => {
    const top: MovieShelf[] = [
      {
        key: "trending",
        kind: "query",
        title: t.search.sortTrending,
        variant: "poster",
        // movieFiltersToQuery's spelling of Trending now, at shelf size.
        query: { ...movieFiltersToQuery({ ...createMovieFilters(), sort: "trending" }), limit: ROW_LIMIT },
        meta: (movie) => [yearOf(movie), movie.genre || null],
        seeAll: { sort: "trending" },
      },
      {
        key: "popular",
        kind: "query",
        title: t.search.sortPopular,
        variant: "ranked",
        query: { sort: "mostViewed", limit: ROW_LIMIT },
        meta: (movie) => [yearOf(movie), movie.genre || null],
        seeAll: { sort: "mostViewed" },
      },
      {
        key: "new",
        kind: "query",
        title: t.search.sortNewReleases,
        variant: "poster",
        query: { sort: "newest", limit: ROW_LIMIT },
        meta: (movie) => [yearOf(movie), movie.genre || null],
        seeAll: { sort: "newest" },
      },
      {
        key: "rated",
        kind: "query",
        // The sort's own name: the shelf, its See all heading and the sort chip agree.
        title: t.search.sortRating,
        variant: "poster",
        // movieFiltersToQuery's spelling of Top rated (rated titles only) — its See all lists the same titles.
        query: { ...movieFiltersToQuery({ ...createMovieFilters(), sort: "rating" }), limit: ROW_LIMIT },
        showRating: true,
        meta: (movie) => [yearOf(movie)],
        seeAll: { sort: "rating" },
      },
      { key: "recent", kind: "recent" },
      {
        key: "free",
        kind: "query",
        title: t.hub.freeToWatch,
        subtitle: t.hub.freeSubtitle,
        variant: "poster",
        query: { accessType: "FREE", limit: ROW_LIMIT },
        meta: (movie) => [movie.genre || null, yearOf(movie)],
        seeAll: { freeOnly: true },
      },
    ];
    const genreShelves: MovieShelf[] = (facetsQuery.data?.genres ?? [])
      .filter((facet) => facet.count > 0)
      .slice(0, GENRE_SHELVES)
      .map((facet) => ({
        key: `genre:${facet.value}`,
        kind: "query",
        title: facet.value,
        variant: "poster",
        // The genre view's own spelling at shelf size.
        query: { ...movieFiltersToQuery({ ...createMovieFilters(), genres: [facet.value] }), limit: ROW_LIMIT },
        meta: (movie) => [yearOf(movie), formatDuration(movie.duration)],
        seeAll: { genres: [facet.value] },
      }));
    const categoryShelves: MovieShelf[] = (categoriesQuery.data ?? [])
      .filter((category) => category.movieCount > 0)
      .slice(0, CATEGORY_SHELVES)
      .map((category) => ({
        key: `category:${category.id}`,
        kind: "query",
        title: category.name,
        variant: "poster",
        // The same `{ categoryId, limit: 10 }` key Browse's shelves use.
        query: { categoryId: category.id, limit: ROW_LIMIT },
        meta: (movie) => [movie.genre || null, yearOf(movie)],
        seeAll: { categoryId: category.id },
      }));
    return [...top, ...interleave(genreShelves, categoryShelves)];
    // `thisYear` re-spells Trending now's years on a New Year's Eve session.
  }, [t, facetsQuery.data, categoriesQuery.data, thisYear]);

  const openShelf = useCallback(
    (patch: Partial<MovieFilters>) => results.open(() => ({ ...createMovieFilters(), ...patch })),
    [results.open],
  );
  const recentItems = useMemo<HubRowItem[]>(
    () =>
      (newestPage?.items ?? []).slice(0, ROW_LIMIT).map((movie) => ({
        key: movie.id,
        title: movie.title,
        // A 16:9 frame: the landscape cover first.
        imageUrl: movie.coverUrl ?? movie.posterUrl,
        accessType: movie.accessType,
        isNew: isRecentlyAdded(movie.createdAt),
        meta: [movie.genre || null, yearOf(movie), formatDuration(movie.duration)],
        onPress: () => openMovie(movie),
      })),
    [newestPage, openMovie],
  );
  const renderShelf = useCallback(
    (shelf: MovieShelf, index: number) =>
      shelf.kind === "recent" ? (
        <HubRow
          style={index === 0 ? styles.firstShelf : styles.shelf}
          variant="landscape"
          title={t.browse.recentlyAdded}
          items={recentItems}
          // Recently added is the default order: its See all is every movie.
          onSeeAll={() => openShelf({})}
        />
      ) : (
        <MovieShelfRow shelf={shelf} first={index === 0} onOpen={openMovie} onSeeAll={openShelf} />
      ),
    [t, recentItems, openShelf, openMovie],
  );

  /* ================================================================== */
  /* RESULTS                                                             */
  /* ================================================================== */

  const resultsQuery = useMoviesInfinite(
    { ...movieFiltersToQuery(filters), limit: LIST_PAGE_SIZE },
    { enabled: showResults },
  );
  const hasSelection = countMovieSelection(filters) > 0;
  /** The genre / category being shown — a change is a new page, not a re-sort. */
  const viewKey = `${filters.categoryId ?? ""}|${filters.genres.join(",")}`;
  // The genre's hero: its newest titles, whatever the grid is sorted by. With
  // no refinements this IS the grid's first page (one request for both).
  const heroQuery = useMoviesInfinite(
    {
      ...movieFiltersToQuery({ ...createMovieFilters(), genres: filters.genres, categoryId: filters.categoryId }),
      limit: LIST_PAGE_SIZE,
    },
    { enabled: showResults && hasSelection },
  );
  // Held-over pages of ANOTHER genre (keepPreviousData) would be the wrong
  // titles under this heading: only this genre's own answer is drawn.
  const heroLoading = heroQuery.isLoading || heroQuery.isPlaceholderData;
  const heroSlides = useMemo(
    () => (heroLoading ? [] : buildSlides(heroQuery.data?.pages[0]?.items ?? [])),
    [heroLoading, heroQuery.data, buildSlides],
  );

  /**
   * Which genre the grid's settled pages belong to, in THIS results visit.
   * Held-over pages of the SAME genre (a new sort or filter) stay on screen,
   * dimmed, until the new answer lands; those of another genre are not shown
   * — skeleton cells instead. Back on browse it is forgotten: a See all that
   * differs only by its sort (Popular after Recently added) is a new page,
   * not a re-sort, so it opens on skeletons, never on the last visit's titles.
   */
  const [settledView, setSettledView] = useState<string | null>(null);
  if (!showResults) {
    if (settledView !== null) setSettledView(null);
  } else if (resultsQuery.data && !resultsQuery.isPlaceholderData && settledView !== viewKey) {
    setSettledView(viewKey);
  }
  const heldOver = resultsQuery.isPlaceholderData;
  const stale = heldOver && settledView === viewKey;
  // A failed first page keeps its error status while a Retry is on the wire
  // (isLoading stays false): show the skeleton for it, not the same error.
  const retrying = resultsQuery.isError && !resultsQuery.data && resultsQuery.isFetching;
  const gridLoading = resultsQuery.isLoading || (heldOver && !stale) || retrying;
  const gridFailed = resultsQuery.isError && !resultsQuery.data && !retrying;
  const gridMovies = useMemo(() => flattenPages(resultsQuery.data?.pages), [resultsQuery.data]);
  const total = resultsQuery.data?.pages[0]?.total ?? 0;

  const categoryName = useMemo(
    () => (filters.categoryId ? (categoriesQuery.data?.find((c) => c.id === filters.categoryId)?.name ?? null) : null),
    [filters.categoryId, categoriesQuery.data],
  );
  const refinements = countMovieRefinements(filters);
  const chips = useMemo(
    () => movieFilterChips(t, filters, results.update, { selection: false }),
    [t, filters, results.update],
  );
  const clearRefinements = useCallback(() => results.update(clearMovieRefinements), [results.update]);
  const clearSelection = useCallback(
    () => results.update((f) => ({ ...f, genres: [], categoryId: null })),
    [results.update],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const openAllFilters = useCallback(
    () => navigation.navigate("SearchFilters", { tab: "movies", term: "" }),
    [navigation],
  );

  /**
   * A new sort or filter answers from the top: if the grid has been scrolled
   * past its heading, the heading comes back up under the pinned chrome.
   * (A new genre remounts the list at the top anyway.)
   */
  const refinementKey = JSON.stringify(movieFiltersToQuery(clearSelectionOf(filters)));
  useEffect(() => {
    if (!showResults) return;
    const headingTop = scroll.allY.current - chromeHeight;
    if (scroll.scrollY.value > headingTop + 1) scroll.scrollToAll();
    // Only a change of refinements moves the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refinementKey]);

  const countLabel = gridLoading || stale
    ? null
    : gridFailed
      ? ""
      : total === 1
        ? t.search.countMoviesOne
        : t.search.countMovies.replace("{n}", String(total));

  const emptyMessage =
    refinements > 0
      ? t.search.noResultsFiltersBody
      : filters.categoryId
        ? categoryName
          ? t.hub.noMoviesInNamedCategory.replace("{category}", categoryName)
          : t.hub.noMoviesInCategory
        : hasSelection
          ? t.hub.noMoviesInGenre
          : t.hub.noMoviesYet;
  const emptyAction =
    refinements > 0
      ? { label: t.search.clearFiltersButton, onPress: clearRefinements }
      : hasSelection
        ? { label: t.hub.allMovies, onPress: clearSelection }
        : null;

  const renderCell = useCallback(
    (movie: Movie, width: number) => (
      <MoviePosterCell movie={movie} width={width} onPress={openMovie} onWatch={watchMovie} drawnFallback markNew />
    ),
    [openMovie, watchMovie],
  );
  const fetchNextPage = resultsQuery.fetchNextPage;
  // `cancelRefetch: false`: a second call while a page is on its way joins
  // it instead of asking again.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

  /* ---- Retry and pull-to-refresh: every movie list on screen ---- */
  const refetchAll = useCallback(
    () =>
      Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["movies"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]),
    [queryClient],
  );
  const [pulling, setPulling] = useState(false);
  const refresh = useCallback(() => {
    setPulling(true);
    void refetchAll().finally(() => setPulling(false));
  }, [refetchAll]);
  const retryHub = useCallback(() => void refetchAll(), [refetchAll]);
  const refetchGrid = resultsQuery.refetch;
  const retryGrid = useCallback(() => void refetchGrid(), [refetchGrid]);

  /* ---- render ---- */
  let body;
  if (!showResults) {
    if (newestQuery.isLoading) {
      body = <HubSkeleton />;
    } else if (newestQuery.isError && !newestQuery.data) {
      body = <HubError onAction={retryHub} busy={newestQuery.isFetching} />;
    } else {
      // An empty catalogue has nothing to put on a shelf: the empty hero alone.
      const hasTitles = (newestPage?.items.length ?? 0) > 0;
      body = (
        <HubBrowseList
          scroll={scroll}
          header={
            <HubHero
              slides={browseSlides}
              accessibilityLabel={t.hub.featuredMovies}
              empty={heroEmpty}
              scrollY={scroll.scrollY}
              paused={!active}
            />
          }
          rows={hasTitles ? shelves : NO_SHELVES}
          rowKey={shelfKey}
          renderRow={renderShelf}
          onRefresh={refresh}
          refreshing={pulling}
        />
      );
    }
  } else {
    const showHero = hasSelection && (heroLoading || heroSlides.length > 0);
    body = (
      <HubAllGrid
        scroll={scroll}
        header={
          showHero ? (
            heroLoading ? (
              <HubHeroSkeleton />
            ) : (
              <HubHero
                slides={heroSlides}
                accessibilityLabel={t.hub.featuredMovies}
                empty={heroEmpty}
                scrollY={scroll.scrollY}
                paused={!active}
              />
            )
          ) : (
            // No hero: the heading starts just under the pinned Media bar and chips.
            <View style={{ height: chromeHeight }} />
          )
        }
        title={resultsTitle(t, filters, categoryName)}
        titleVariant={showHero ? "section" : "title"}
        compactTop={!showHero}
        focusTitleOnMount
        toolbar={
          <MediaResultsHeader
            countLabel={countLabel}
            filterCount={refinements}
            chips={chips}
            onOpenSheet={openSheet}
            onClearAll={clearRefinements}
          />
        }
        items={gridMovies}
        keyExtractor={movieKey}
        renderCell={renderCell}
        renderSkeletonCell={renderSkeletonCell}
        loading={gridLoading}
        stale={stale}
        refetching={resultsQuery.isFetching && !resultsQuery.isFetchingNextPage}
        error={gridFailed}
        onRetry={retryGrid}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
        hasNextPage={!!resultsQuery.hasNextPage}
        fetchingNextPage={resultsQuery.isFetchingNextPage}
        nextPageFailed={resultsQuery.isFetchNextPageError}
        onLoadMore={loadMore}
        onRefresh={refresh}
        refreshing={pulling}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Browse ⇄ results and genre ⇄ genre cross-fade in (a plain swap under reduce motion). */}
      <FadeInView key={showResults ? `results:${viewKey}` : "browse"} duration={260} style={styles.fill}>
        {body}
      </FadeInView>
      <SortFilterSheet
        visible={sheetOpen}
        onClose={closeSheet}
        kind="movies"
        term=""
        onOpenAllFilters={openAllFilters}
      />
    </View>
  );
});

/** The filters without the genre / category — what the Sort & filter sheet edits. */
function clearSelectionOf(f: MovieFilters): MovieFilters {
  return { ...f, genres: [], categoryId: null };
}

/**
 * One browse shelf that asks for its own titles — mounted (and so asking)
 * only as the browse list brings it near the screen.
 */
const MovieShelfRow = memo(function MovieShelfRow({
  shelf,
  first,
  onOpen,
  onSeeAll,
}: {
  shelf: Extract<MovieShelf, { kind: "query" }>;
  first: boolean;
  onOpen: (movie: Movie) => void;
  onSeeAll: (patch: Partial<MovieFilters>) => void;
}) {
  const query = useMovies(shelf.query, BROWSE_OPTIONS);
  const items = useMemo(
    () =>
      (query.data?.items ?? [])
        .slice(0, ROW_LIMIT)
        .map(
          (movie): HubRowItem => ({
            key: movie.id,
            title: movie.title,
            imageUrl: movie.posterUrl ?? movie.coverUrl,
            accessType: movie.accessType,
            rating: shelf.showRating && movie.rating > 0 ? movie.rating : null,
            isNew: shelf.variant === "poster" && isRecentlyAdded(movie.createdAt),
            meta: shelf.meta(movie),
            onPress: () => onOpen(movie),
          }),
        ),
    [query.data, shelf, onOpen],
  );
  return (
    <HubRow
      style={first ? styles.firstShelf : styles.shelf}
      variant={shelf.variant}
      title={shelf.title}
      subtitle={shelf.subtitle}
      items={items}
      loading={query.isLoading}
      onSeeAll={() => onSeeAll(shelf.seeAll)}
    />
  );
});

const NO_SHELVES: MovieShelf[] = [];
const shelfKey = (shelf: MovieShelf) => shelf.key;
const movieKey = (movie: Movie) => movie.id;
const renderSkeletonCell = (width: number) => <PosterCellSkeleton width={width} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  fill: { flex: 1 },
  firstShelf: { marginTop: 10 },
  shelf: { marginTop: HUB_SECTION_GAP },
});

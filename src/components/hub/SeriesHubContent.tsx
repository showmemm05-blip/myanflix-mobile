import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { FadeInView } from "@/components/ui/FadeInView";
import { isRecentlyAdded } from "@/components/movie/mediaItems";
import { EPISODE_COMPLETED_THRESHOLD } from "@/components/series/SeasonEpisodeItem";
import { PosterCellSkeleton, SeriesPosterCell } from "@/components/search/PosterCell";
import { SortFilterSheet } from "@/components/search/SortFilterSheet";
import {
  DEFAULT_SERIES_SORT,
  clearSeriesRefinements,
  countSeriesRefinements,
  countSeriesSelection,
  createSeriesFilters,
  selectionLabel,
  seriesFilterChips,
  seriesFiltersToQuery,
  sortChoiceLabel,
  type SeriesFilters,
} from "@/components/search/filters";
import { HubHero, type HubHeroMetaStrong, type HubHeroSlide } from "@/components/hub/HubHero";
import { HubRow, type HubRowItem } from "@/components/hub/HubRow";
import { HubAllGrid } from "@/components/hub/HubAllGrid";
import { HubBrowseList } from "@/components/hub/HubBrowseList";
import { MediaResultsHeader } from "@/components/hub/MediaResultsHeader";
import { HubError, HubHeroSkeleton, HubSkeleton } from "@/components/hub/HubStates";
import { HUB_SECTION_GAP, joinMeta, useHubChromeHeight } from "@/components/hub/hubLayout";
import { featureNewest } from "@/components/hub/hubFeatured";
import type { HubScroll } from "@/components/hub/useHubScroll";
import type { SeriesMediaResults } from "@/components/hub/useMediaResults";
import { useMediaTabNavigation } from "@/components/hub/mediaTabNavigation";
import { useEpisodes, usePlayerEpisodes, useSeriesFacets, useSeriesInfinite, useSeriesList } from "@/hooks/useSeries";
import { useCategories } from "@/hooks/useCategories";
import { useSubscriptionStatus } from "@/hooks/useSubscription";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import { LIST_PAGE_SIZE, flattenPages } from "@/hooks/pagination";
import { useAuthStore } from "@/store/authStore";
import { useLanguage } from "@/localization/LanguageProvider";
import type { TranslationShape } from "@/localization/translations";
import { hasAccess } from "@/utils/access";
import { theme } from "@/theme";
import type { Movie } from "@/types/movie";
import type { MovieCategoryRef } from "@/types/category";
import type { PlayerEpisodesResponse, SeriesListItem, SeriesQuery } from "@/types/series";

interface Props {
  /**
   * The Series chip is on screen and the Media tab's root is focused. The
   * hub stays mounted while another chip shows (or a screen is pushed over
   * it) — so it keeps its data — and only its hero's pager holds still.
   */
  active: boolean;
  /** Owned by the Media screen, which fades its bar in from it (useHubScroll). */
  scroll: HubScroll;
  /**
   * Browse or results, the filters the results list with, and the category
   * they are narrowed to (useSeriesResults, owned by the Media screen).
   */
  results: SeriesMediaResults;
}

/** The story pager's five titles. */
const HERO_COUNT = 5;
/** Every shelf shows ten. */
const ROW_LIMIT = 10;
/** How many genre shelves browse offers (most series first). */
const GENRE_SHELVES = 10;
/**
 * How long the browse shelves and the newest list stay fresh: the catalogue
 * changes far less often than a search, so coming back to the Media tab
 * within five minutes re-asks nothing. The results grid keeps the 30s
 * search window (useSeriesInfinite's default).
 */
const BROWSE_STALE_TIME_MS = 5 * 60_000;
/**
 * ONE request feeds the browse hero, Recently added and the category shelf
 * — and the unfiltered results view too, because that view sends no `sort`
 * (recentlyAdded is the server's default) and so is this very key.
 * (CategoryDetail's Series tab sends a categoryId, so it has its own key.)
 */
const BASE_QUERY = { limit: LIST_PAGE_SIZE } as const;

/** A browse shelf that asks for its own series, and what its "See all" opens. */
interface SeriesShelf {
  key: string;
  kind: "query" | "recent" | "category";
  title: string;
  subtitle?: string;
  query?: SeriesQuery;
  /** The results view's filters for "See all"; none = no See all. */
  seeAll?: Partial<SeriesFilters>;
}

/** One episode the hero's main button can open. */
interface EpisodeRef {
  id: string;
  seasonNumber: number;
  episodeNumber: number | null;
}

/**
 * Where a slide's episode facts came from:
 * - "progress" — GET /series/:id/player-episodes: the episodes in order AND the
 *   viewer's own progress. Asked only when the viewer can watch the show,
 *   exactly as SeriesDetails asks.
 * - "episodes" — GET /series/:id/episodes: the episodes in order only (a
 *   premium show the viewer cannot watch yet; also the guest path).
 */
type WatchSource = "progress" | "episodes";

/** One slide's episode facts being asked for: which endpoint, which series. */
interface Ask {
  source: WatchSource;
  id: string;
}

/** What the hero knows about one series' episodes — kept for the whole visit. */
interface WatchInfo {
  /**
   * The episodes this viewer can actually open (both endpoints list PUBLISHED
   * only). The list item's `episodeCount` also counts drafts and uploads
   * still processing, so once this is known the hero says this instead.
   */
  episodes: number;
  /** Seasons that hold at least one episode. */
  seasons: number;
  /** What Play opens; null = no episode yet. */
  target: EpisodeRef | null;
  /** Something has been started and an episode is still under 95%. */
  resuming: boolean;
}

/**
 * SeriesDetails' order: seasons ascending (an episode with no season is
 * season 1), then episode number within the season (none sorts first).
 */
function orderEpisodes<T extends EpisodeRef>(episodes: T[]): T[] {
  return [...episodes].sort(
    (a, b) => a.seasonNumber - b.seasonNumber || (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
  );
}

function seasonCount(episodes: EpisodeRef[]): number {
  return new Set(episodes.map((episode) => episode.seasonNumber)).size;
}

/** No progress to go on (a locked viewer): Play is S1 E1, never "Resume". */
function watchInfoFromEpisodes(episodes: Movie[]): WatchInfo {
  const ordered = orderEpisodes(
    episodes.map((episode) => ({
      id: episode.id,
      seasonNumber: episode.seasonNumber ?? 1,
      episodeNumber: episode.episodeNumber,
    })),
  );
  return { episodes: ordered.length, seasons: seasonCount(ordered), target: ordered[0] ?? null, resuming: false };
}

/**
 * SeriesDetails' `playTarget` rule, over the player's own list: the first
 * episode (season order) not yet watched to 95%, "resuming" once anything has
 * been started; every episode finished → back to S1 E1. The player's list
 * is the same PUBLISHED set in the same order as GET /episodes (it only
 * drops an episode with no season number, which an upload never produces).
 */
function watchInfoFromProgress(data: PlayerEpisodesResponse): WatchInfo {
  const ordered = orderEpisodes(
    data.seasons.flatMap((season) =>
      season.episodes.map((episode) => ({
        id: episode.id,
        seasonNumber: season.seasonNumber,
        episodeNumber: episode.episodeNumber,
        percent: episode.watchProgress?.progressPercent ?? 0,
      })),
    ),
  );
  const started = ordered.some((episode) => episode.percent > 0);
  const firstUnfinished = ordered.find((episode) => episode.percent < EPISODE_COMPLETED_THRESHOLD);
  const target = firstUnfinished ?? ordered[0] ?? null;
  return {
    episodes: ordered.length,
    seasons: seasonCount(ordered),
    target: target ? { id: target.id, seasonNumber: target.seasonNumber, episodeNumber: target.episodeNumber } : null,
    resuming: started && !!firstUnfinished,
  };
}

/**
 * The category row's category: the one most of the FIRST page's series belong
 * to (ties by name). Page one only, so the row never changes its heading
 * under the user as more pages land.
 */
function mostCommonCategory(series: SeriesListItem[]): MovieCategoryRef | null {
  const tally = new Map<string, { ref: MovieCategoryRef; n: number }>();
  for (const item of series) {
    for (const category of item.categories) {
      const entry = tally.get(category.id);
      if (entry) entry.n += 1;
      else tally.set(category.id, { ref: category, n: 1 });
    }
  }
  let best: { ref: MovieCategoryRef; n: number } | null = null;
  for (const entry of tally.values()) {
    if (!best || entry.n > best.n || (entry.n === best.n && entry.ref.name.localeCompare(best.ref.name) < 0)) {
      best = entry;
    }
  }
  return best?.ref ?? null;
}

/**
 * The results view's heading: the category and genre(s), or — for Newest,
 * the New releases shelf's See all — the sort, under the very name its chip
 * and the sheet give it ("Newest releases"), so one screen never names it
 * two ways. `categoryName` is the picked category's name, null when none is.
 */
function resultsTitle(t: TranslationShape, f: SeriesFilters, categoryName: string | null): string {
  const picked = selectionLabel(f.genres, categoryName);
  if (picked) return picked;
  if (f.sort === "newest") return sortChoiceLabel(t, f.sort, "series");
  return f.freeOnly && f.sort === DEFAULT_SERIES_SORT ? t.hub.freeToWatch : t.hubs.series.allSeries;
}

/**
 * The Series hub, as the body of the Media tab's Series chip — the Movies
 * hub's model (browse → genre → titles → more by themselves) over what the
 * series API can honestly answer: no popularity or rating sort.
 *
 * BROWSE: the hero — the five newest series with at least one episode,
 * those with art first; NEW from createdAt, PREMIUM/FREE, "N seasons · N
 * episodes" and the main button ("Resume S1 E3" / "Play S1 E1" by
 * SeriesDetails' rule, or the gold Subscribe when the show is locked; the
 * episode facts are fetched for the slide ON SCREEN only, once per visit) —
 * then New releases (release year), Recently added, Free to watch, the
 * category shelf (picked from, and filled from, the newest page already in
 * hand — no request of its own, so it has no See all) and the genre shelves
 * (GET /series/facets), each asking for its series as it scrolls into view.
 *
 * RESULTS (a genre or category from the Categories overlay, a shelf's See
 * all, or any active filter): that genre's hero when it has series, the
 * heading, the count, the filter row (Sort & filter, removable chips, Clear
 * all) and a 3-column grid that pages by itself — see MoviesHubContent. A
 * CATEGORY is sent to the server (GET /series?categoryId=), exactly like a
 * genre: one request per page of real matches, and the count is the server's
 * exact total from the first page. Nothing matching is the honest empty
 * state, with "All series" to go back.
 */
export const SeriesHubContent = memo(function SeriesHubContent({ active, scroll, results }: Props) {
  const { t } = useLanguage();
  const navigation = useMediaTabNavigation();
  const queryClient = useQueryClient();
  const chromeHeight = useHubChromeHeight();

  // A guest has no subscription to ask about, and /subscriptions/me and
  // /series/:id/player-episodes both 401 a guest into the logout path (which
  // empties the whole query cache) — so neither is asked unless signed in.
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const subscriptionQuery = useSubscriptionStatus({ enabled: isAuthenticated });
  const isSubscribed = subscriptionQuery.data?.isActive ?? false;
  const subscriptionPending = isAuthenticated && subscriptionQuery.isPending;
  const savedIds = useWatchlist().data;
  // `mutate` is bound once per observer, so this holds its identity.
  const toggleSaved = useToggleWatchlist().mutate;

  /* ---- navigation ---- */
  const openSeries = useCallback(
    (series: Pick<SeriesListItem, "id">) => navigation.navigate("SeriesDetails", { seriesId: series.id }),
    [navigation],
  );
  const playEpisode = useCallback(
    (episodeId: string) => navigation.navigate("Player", { movieId: episodeId }),
    [navigation],
  );
  const openSubscribe = useCallback(() => navigation.navigate("Subscribe"), [navigation]);

  const episodesLabel = useCallback(
    (n: number) => (n === 1 ? t.hubs.series.episodesOne : t.hubs.series.episodes.replace("{n}", String(n))),
    [t],
  );

  /* ---- the shared data ---- */
  const { filters, showResults, categoryId } = results;
  const baseQuery = useSeriesInfinite(BASE_QUERY, { staleTime: BROWSE_STALE_TIME_MS });
  const firstPage = baseQuery.data?.pages[0]?.items;
  const facetsQuery = useSeriesFacets();

  /* ---- the results view's queries ---- */
  // The category travels as GET /series?categoryId= — the server filters it,
  // like a genre — so one page of real matches per request.
  const inCategory = categoryId ? { categoryId } : {};
  const listQuery = { ...seriesFiltersToQuery(filters), ...inCategory, limit: LIST_PAGE_SIZE };
  const resultsQuery = useSeriesInfinite(listQuery, { enabled: showResults });
  const hasSelection = countSeriesSelection(filters) > 0 || !!categoryId;
  /** The category / genre being shown — a change is a new page, not a re-sort. */
  const viewKey = `${categoryId ?? ""}|${filters.genres.join(",")}`;
  // The genre's (or category's) hero: its newest series, whatever the grid is
  // sorted by. With no refinements this IS the grid's first page (one request
  // for both — React Query hashes the key with its fields sorted).
  const genreHeroQuery = useSeriesInfinite(
    {
      ...seriesFiltersToQuery({ ...createSeriesFilters(), genres: filters.genres }),
      ...inCategory,
      limit: LIST_PAGE_SIZE,
    },
    { enabled: showResults && hasSelection },
  );
  // Held-over pages of ANOTHER genre (keepPreviousData) would be the wrong
  // series under this heading: only this genre's own answer is drawn.
  const genreHeroLoading = genreHeroQuery.isLoading || genreHeroQuery.isPlaceholderData;

  /** First page only, so the slides never change under the user as the grid pulls more pages. */
  const selectionHeroPage = genreHeroQuery.data?.pages[0]?.items;

  /* ---- the hero's titles: browse → the newest; a genre / category → its newest ---- */
  const heroSource = showResults ? (hasSelection && !genreHeroLoading ? selectionHeroPage : undefined) : firstPage;
  const heroSeries = useMemo(
    () =>
      featureNewest(
        // A slide whose main button has nothing to play is no feature. The
        // count also includes drafts and uploads still processing, so a slide
        // can still turn out empty: its facts then show "No episodes yet".
        (heroSource ?? []).filter((series) => series.episodeCount > 0),
        (series) => !!(series.posterUrl ?? series.coverUrl),
        HERO_COUNT,
      ),
    [heroSource],
  );

  /* ---- the episode facts of the slide on screen ---- */
  /** Reported by the hero on every change of slide — setState is stable, as its effect needs. */
  const [activeIndex, setActiveIndex] = useState(0);
  const [watchInfo, setWatchInfo] = useState<Record<string, WatchInfo>>({});
  /**
   * `${source}:${seriesId}` whose answer has landed this visit, so it is not
   * asked again. Without it every slide would refetch on each pass of the
   * pager: a pass is 5 × 7s = 35s, just past the app's 30s stale window.
   * A key is only added once its fetch has SETTLED — switching the hook off
   * mid-flight would cancel the request (its signal is forwarded).
   */
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set());

  const onScreen = heroSeries[activeIndex] ?? null;
  // Until a signed-in viewer's subscription is known, a premium show could go
  // either way — wait rather than ask the wrong endpoint.
  const activeSource: WatchSource | null =
    !onScreen || (onScreen.accessType !== "FREE" && subscriptionPending)
      ? null
      : isAuthenticated && hasAccess(onScreen.accessType, isSubscribed)
        ? "progress"
        : "episodes";
  /** The slide on screen, while its facts are not yet known. */
  const wantedId = onScreen && activeSource && !settled.has(`${activeSource}:${onScreen.id}`) ? onScreen.id : null;
  const wantedSource = wantedId ? activeSource : null;
  /**
   * What the two hooks below are asking right now. It follows the slide on
   * screen, EXCEPT that an ask still in flight is kept until it lands (or
   * fails): moving a hook to the next slide's key would cancel it (the signal
   * is forwarded), so on a slow network — one request longer than a 7s slide —
   * no slide would ever settle and every pass would ask again. Meanwhile the
   * new slide says a plain "Play" (the series page), as before its answer.
   * The client's 15s timeout bounds how long one ask can hold on.
   */
  const [ask, setAsk] = useState<Ask | null>(null);
  const progressId = ask?.source === "progress" ? ask.id : undefined;
  const episodesId = ask?.source === "episodes" ? ask.id : undefined;
  // The same cache keys SeriesDetails reads, so the series page opens warm.
  const progressQuery = usePlayerEpisodes(progressId);
  const episodesQuery = useEpisodes(episodesId);
  const askInFlight = (!!progressId && progressQuery.isFetching) || (!!episodesId && episodesQuery.isFetching);
  useEffect(() => {
    if (askInFlight) return;
    setAsk((prev) => {
      if (prev && prev.id === wantedId && prev.source === wantedSource) return prev;
      return wantedId && wantedSource ? { source: wantedSource, id: wantedId } : null;
    });
  }, [askInFlight, wantedId, wantedSource]);

  /**
   * Back from the player (or a series page), what was watched has moved on:
   * every slide asks for its progress again when it is next on screen, and
   * the one on screen now asks straight away — SeriesDetails does the same
   * on focus. The first focus is the mount, which asks anyway. While the hub
   * is hidden (another chip, or a screen pushed over it) the ask waits until it
   * is on screen again, so a return to the Media tab does not fetch for a
   * hero nobody can see.
   */
  const focusedOnce = useRef(false);
  /** A return to this page the hub has not answered yet — held while it is hidden. */
  const [returnPending, setReturnPending] = useState(false);
  /** Bumped once per answered return; the progress effect answers each bump once. */
  const [focusEpoch, setFocusEpoch] = useState(0);
  const refreshedEpoch = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      setReturnPending(true);
    }, []),
  );
  useEffect(() => {
    if (!active || !returnPending) return;
    setReturnPending(false);
    setFocusEpoch((n) => n + 1);
    setSettled((prev) => new Set([...prev].filter((key) => !key.startsWith("progress:"))));
  }, [active, returnPending]);

  const refetchProgress = progressQuery.refetch;
  useEffect(() => {
    if (!progressId) return;
    if (refreshedEpoch.current !== focusEpoch) {
      refreshedEpoch.current = focusEpoch;
      // Already on its way (the cached answer was stale) — that fetch is the fresh one.
      if (!progressQuery.isFetching) {
        void refetchProgress();
        return;
      }
    }
    if (!progressQuery.data) return;
    const info = watchInfoFromProgress(progressQuery.data);
    setWatchInfo((prev) => ({ ...prev, [progressId]: info }));
    if (!progressQuery.isFetching) setSettled((prev) => new Set(prev).add(`progress:${progressId}`));
  }, [progressId, progressQuery.data, progressQuery.isFetching, refetchProgress, focusEpoch]);

  useEffect(() => {
    if (!episodesId || !episodesQuery.data) return;
    const info = watchInfoFromEpisodes(episodesQuery.data);
    setWatchInfo((prev) => ({ ...prev, [episodesId]: info }));
    if (!episodesQuery.isFetching) setSettled((prev) => new Set(prev).add(`episodes:${episodesId}`));
  }, [episodesId, episodesQuery.data, episodesQuery.isFetching]);

  /* ---- the hero ---- */
  const slides = useMemo<HubHeroSlide[]>(
    () =>
      heroSeries.map((series) => {
        const isNew = isRecentlyAdded(series.createdAt);
        // A premium show while a signed-in viewer's subscription is still on
        // its way could go either way: neither the gold Subscribe (wrong for a
        // subscriber) nor an episode — a plain "Play" to the series page,
        // which decides for itself.
        const accessPending = series.accessType !== "FREE" && subscriptionPending;
        const canWatch = !accessPending && hasAccess(series.accessType, isSubscribed);
        const locked = !accessPending && !canWatch;
        const info = watchInfo[series.id];
        const target = canWatch ? (info?.target ?? null) : null;
        const resuming = canWatch && !!info?.resuming;
        // Known to hold nothing this viewer can open yet (its episodes are all
        // drafts or still processing, which `episodeCount` counts anyway).
        const nothingToPlay = canWatch && !!info && info.episodes === 0;
        const numbered = target && target.episodeNumber !== null ? target : null;
        const code = numbered
          ? t.series.episodeCode.replace("{s}", String(numbered.seasonNumber)).replace("{e}", String(numbered.episodeNumber))
          : null;
        const verb = resuming ? t.hubs.series.resume : t.player.play;
        // Until the slide's episodes are known the button says just "Play" —
        // never an episode code it has not seen.
        const label = locked
          ? t.series.subscribeToWatch
          : nothingToPlay
            ? t.series.episodesEmpty
            : code
              ? (resuming ? t.hubs.series.resumeCode : t.hubs.series.playCode).replace("{code}", code)
              : verb;
        const spoken =
          canWatch && numbered
            ? t.series.playEpisodeA11y
                .replace("{action}", verb)
                .replace("{title}", series.title)
                .replace("{s}", String(numbered.seasonNumber))
                .replace("{e}", String(numbered.episodeNumber))
            : t.hub.actionTitleA11y
                .replace("{action}", locked ? t.series.subscribeToWatch : nothingToPlay ? t.series.episodesEmpty : verb)
                .replace("{title}", series.title);
        // Seasons only once they are actually known — never a guess.
        const seasons =
          info && info.seasons > 0
            ? info.seasons === 1
              ? t.hubs.series.seasonsOne
              : t.hubs.series.seasons.replace("{n}", String(info.seasons))
            : null;
        // The viewer's own count once known; "No episodes yet" when it is
        // none — unless the disabled main button already says so.
        const episodes = info
          ? info.episodes > 0
            ? episodesLabel(info.episodes)
            : nothingToPlay
              ? null
              : t.series.episodesEmpty
          : episodesLabel(series.episodeCount);
        const countsText = joinMeta([seasons, episodes]);
        // Drawn bold white, as the board draws "2 seasons · 10 episodes".
        const counts: HubHeroMetaStrong | null = countsText ? { text: countsText, strong: true } : null;
        return {
          key: series.id,
          title: series.title,
          // The stage is portrait: the poster first, the cover if that is all there is.
          imageUrl: series.posterUrl ?? series.coverUrl,
          isNew,
          accessType: series.accessType,
          kicker: resuming ? t.series.continueWatching : isNew ? t.browse.recentlyAdded : t.hubs.series.featured,
          rating: series.rating > 0 ? series.rating : null,
          meta: [series.releaseYear > 0 ? series.releaseYear : null, counts, series.genre || null],
          blurb: series.description || null,
          primary: {
            kind: locked ? "subscribe" : "play",
            label,
            // Pressed before the slide's episodes (or the viewer's access) are
            // known — a moment, on its first time round — the series page,
            // whose Play is right there.
            onPress: locked ? openSubscribe : target ? () => playEpisode(target.id) : () => openSeries(series),
            disabled: nothingToPlay,
            accessibilityLabel: spoken,
          },
          secondary: {
            label: t.hub.myList,
            toggled: !!savedIds?.includes(series.id),
            onPress: () => toggleSaved(series.id),
          },
          info: {
            icon: "information-circle-outline",
            onPress: () => openSeries(series),
            accessibilityLabel: t.hub.moreAbout.replace("{title}", series.title),
          },
        };
      }),
    [
      heroSeries,
      isSubscribed,
      subscriptionPending,
      watchInfo,
      savedIds,
      t,
      episodesLabel,
      openSubscribe,
      playEpisode,
      openSeries,
      toggleSaved,
    ],
  );
  /**
   * Nothing to feature. With no series at all the hero says so; with series
   * but none holding an episode yet (only those can be featured) the shelves
   * below DO list series, so it says what is actually missing instead.
   */
  const anySeries = (firstPage?.length ?? 0) > 0;
  const heroEmpty = useMemo(
    () =>
      anySeries
        ? { title: t.hub.emptyEpisodesTitle, message: t.hub.emptyEpisodesBody, seed: "series" }
        : { title: t.hub.emptySeriesTitle, message: t.hub.emptySeriesBody, seed: "series" },
    [anySeries, t],
  );

  /* ================================================================== */
  /* BROWSE                                                              */
  /* ================================================================== */

  /**
   * The category shelf (the board's "Myanmar classics"): the category most of
   * the newest page belongs to, filled from the series pages already loaded
   * (`series.categories` includes the id) — no request of its own. Not a
   * full list of the category, so no See all.
   */
  const rowCategory = useMemo(() => mostCommonCategory(firstPage ?? []), [firstPage]);
  const posterItem = useCallback(
    (series: SeriesListItem): HubRowItem => ({
      key: series.id,
      title: series.title,
      imageUrl: series.posterUrl ?? series.coverUrl,
      accessType: series.accessType,
      isNew: isRecentlyAdded(series.createdAt),
      meta: [series.releaseYear > 0 ? series.releaseYear : null, episodesLabel(series.episodeCount)],
      onPress: () => openSeries(series),
    }),
    [episodesLabel, openSeries],
  );
  const recentItems = useMemo<HubRowItem[]>(
    () =>
      (firstPage ?? []).slice(0, ROW_LIMIT).map((series) => ({
        key: series.id,
        title: series.title,
        // A 16:9 frame: the landscape cover first.
        imageUrl: series.coverUrl ?? series.posterUrl,
        accessType: series.accessType,
        isNew: isRecentlyAdded(series.createdAt),
        meta: [series.genre || null, series.releaseYear > 0 ? series.releaseYear : null, episodesLabel(series.episodeCount)],
        onPress: () => openSeries(series),
      })),
    [firstPage, episodesLabel, openSeries],
  );
  const categoryItems = useMemo(
    () =>
      rowCategory
        ? flattenPages(baseQuery.data?.pages)
            .filter((series) => series.categories.some((category) => category.id === rowCategory.id))
            .slice(0, ROW_LIMIT)
            .map(posterItem)
        : [],
    [rowCategory, baseQuery.data, posterItem],
  );

  const shelves = useMemo<SeriesShelf[]>(() => {
    const top: SeriesShelf[] = [
      {
        key: "new",
        kind: "query",
        title: t.search.sortNewReleases,
        query: { sort: "newest", limit: ROW_LIMIT },
        seeAll: { sort: "newest" },
      },
      // Recently added is the default order: its See all is every series.
      { key: "recent", kind: "recent", title: t.browse.recentlyAdded, seeAll: {} },
      {
        key: "free",
        kind: "query",
        title: t.hub.freeToWatch,
        subtitle: t.hub.freeSubtitle,
        query: { accessType: "FREE", limit: ROW_LIMIT },
        seeAll: { freeOnly: true },
      },
    ];
    const genres: SeriesShelf[] = (facetsQuery.data?.genres ?? [])
      .filter((facet) => facet.count > 0)
      .slice(0, GENRE_SHELVES)
      .map((facet) => ({
        key: `genre:${facet.value}`,
        kind: "query",
        title: facet.value,
        // The genre view's own spelling at shelf size.
        query: { ...seriesFiltersToQuery({ ...createSeriesFilters(), genres: [facet.value] }), limit: ROW_LIMIT },
        seeAll: { genres: [facet.value] },
      }));
    const category: SeriesShelf[] = rowCategory
      ? [{ key: `category:${rowCategory.id}`, kind: "category", title: rowCategory.name }]
      : [];
    // The category shelf after the first two genres, as the Movies hub interleaves.
    return [...top, ...genres.slice(0, 2), ...category, ...genres.slice(2)];
  }, [t, facetsQuery.data, rowCategory]);

  const openShelf = useCallback(
    (patch: Partial<SeriesFilters>) => results.open(() => ({ ...createSeriesFilters(), ...patch })),
    [results.open],
  );
  const renderShelf = useCallback(
    (shelf: SeriesShelf, index: number) => {
      const style = index === 0 ? styles.firstShelf : styles.shelf;
      const seeAll = shelf.seeAll;
      if (shelf.kind === "recent") {
        return (
          <HubRow
            style={style}
            variant="landscape"
            title={shelf.title}
            items={recentItems}
            onSeeAll={seeAll ? () => openShelf(seeAll) : undefined}
          />
        );
      }
      if (shelf.kind === "category") return <HubRow style={style} title={shelf.title} items={categoryItems} />;
      return <SeriesShelfRow shelf={shelf} style={style} toItem={posterItem} onSeeAll={openShelf} />;
    },
    [recentItems, categoryItems, posterItem, openShelf],
  );

  /* ================================================================== */
  /* RESULTS                                                             */
  /* ================================================================== */

  /**
   * Which genre the grid's settled pages belong to, in THIS results visit —
   * forgotten back on browse, so a See all that differs only by its sort
   * opens on skeletons, never on the last visit's series (MoviesHubContent).
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
  const resultPages = resultsQuery.data?.pages;
  const gridSeries = useMemo(() => flattenPages(resultPages), [resultPages]);
  const total = resultPages?.[0]?.total ?? 0;
  const hasNextPage = !!resultsQuery.hasNextPage;
  const fetchNextPage = resultsQuery.fetchNextPage;
  const gridLoading = resultsQuery.isLoading || (heldOver && !stale) || retrying;
  const gridFailed = resultsQuery.isError && !resultsQuery.data && !retrying;
  const categoriesQuery = useCategories();
  const categoryName = useMemo(
    () => (categoryId ? (categoriesQuery.data?.find((c) => c.id === categoryId)?.name ?? null) : null),
    [categoryId, categoriesQuery.data],
  );

  const refinements = countSeriesRefinements(filters);
  const chips = useMemo(
    () => seriesFilterChips(t, filters, results.update, { selection: false }),
    [t, filters, results.update],
  );
  const clearRefinements = useCallback(() => results.update(clearSeriesRefinements), [results.update]);
  const setCategoryId = results.setCategoryId;
  const clearSelection = useCallback(() => {
    results.update((f) => ({ ...f, genres: [] }));
    setCategoryId(null);
  }, [results.update, setCategoryId]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const openAllFilters = useCallback(
    () => navigation.navigate("SearchFilters", { tab: "series", term: "" }),
    [navigation],
  );

  /**
   * A new sort or filter answers from the top: if the grid has been scrolled
   * past its heading, the heading comes back up under the pinned chrome.
   * (A new genre remounts the list at the top anyway.)
   */
  const refinementKey = JSON.stringify(seriesFiltersToQuery({ ...filters, genres: [] }));
  useEffect(() => {
    if (!showResults) return;
    const headingTop = scroll.allY.current - chromeHeight;
    if (scroll.scrollY.value > headingTop + 1) scroll.scrollToAll();
    // Only a change of refinements moves the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refinementKey]);

  /** The server's total — exact for a genre and a category alike. */
  const countLabel = gridLoading || stale
    ? null
    : gridFailed
      ? ""
      : total === 1
        ? t.search.countSeriesOne
        : t.search.countSeries.replace("{n}", String(total));

  const emptyMessage =
    refinements > 0
      ? t.search.noResultsFiltersBody
      : categoryId
        ? categoryName
          ? t.hubs.series.noSeriesInNamedCategory.replace("{category}", categoryName)
          : t.hubs.series.noSeriesInCategory
        : hasSelection
          ? t.hubs.series.noSeriesInGenre
          : t.hubs.series.noSeriesYet;
  const emptyAction =
    refinements > 0
      ? { label: t.search.clearFiltersButton, onPress: clearRefinements }
      : hasSelection
        ? { label: t.hubs.series.allSeries, onPress: clearSelection }
        : null;

  const renderCell = useCallback(
    (series: SeriesListItem, width: number) => (
      <SeriesPosterCell series={series} width={width} onPress={openSeries} drawnFallback markNew />
    ),
    [openSeries],
  );
  // `cancelRefetch: false`: a second call while a page is on its way joins
  // it instead of asking again.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);

  /* ---- Retry and pull-to-refresh: every series list on screen (and the category names) ---- */
  const refetchAll = useCallback(
    () =>
      Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["series"] }),
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
    if (baseQuery.isLoading) {
      body = <HubSkeleton />;
    } else if (baseQuery.isError && !baseQuery.data) {
      body = <HubError onAction={retryHub} busy={baseQuery.isFetching} />;
    } else {
      body = (
        <HubBrowseList
          scroll={scroll}
          header={
            <HubHero
              slides={slides}
              accessibilityLabel={t.hubs.series.featured}
              empty={heroEmpty}
              scrollY={scroll.scrollY}
              onIndexChange={setActiveIndex}
              paused={!active}
            />
          }
          // An empty catalogue has nothing to put on a shelf: the empty hero alone.
          rows={anySeries ? shelves : NO_SHELVES}
          rowKey={shelfKey}
          renderRow={renderShelf}
          onRefresh={refresh}
          refreshing={pulling}
        />
      );
    }
  } else {
    const showHero = hasSelection && (genreHeroLoading || slides.length > 0);
    body = (
      <HubAllGrid
        scroll={scroll}
        header={
          showHero ? (
            genreHeroLoading ? (
              <HubHeroSkeleton />
            ) : (
              <HubHero
                slides={slides}
                accessibilityLabel={t.hubs.series.featured}
                empty={heroEmpty}
                scrollY={scroll.scrollY}
                onIndexChange={setActiveIndex}
                paused={!active}
              />
            )
          ) : (
            // No hero: the heading starts just under the pinned Media bar and chips.
            <View style={{ height: chromeHeight }} />
          )
        }
        title={resultsTitle(t, filters, categoryId ? (categoryName ?? t.browse.categoryOverline) : null)}
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
        items={gridSeries}
        keyExtractor={seriesKey}
        renderCell={renderCell}
        renderSkeletonCell={renderSkeletonCell}
        loading={gridLoading}
        stale={stale}
        refetching={resultsQuery.isFetching && !resultsQuery.isFetchingNextPage}
        error={gridFailed}
        onRetry={retryGrid}
        emptyMessage={emptyMessage}
        emptyAction={emptyAction}
        hasNextPage={hasNextPage}
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
        kind="series"
        term=""
        // Not while a category is applied: the SearchFilters page and this
        // sheet count their "Show N results" without the category (they are
        // not told it), so they would promise series outside it. The sheet
        // itself keeps sort, year, a language and free only; only several
        // genres / languages at once go.
        onOpenAllFilters={categoryId ? undefined : openAllFilters}
        // That count would include series outside the category.
        countable={!categoryId}
      />
    </View>
  );
});

/**
 * One browse shelf that asks for its own series — mounted (and so asking)
 * only as the browse list brings it near the screen.
 */
const SeriesShelfRow = memo(function SeriesShelfRow({
  shelf,
  style,
  toItem,
  onSeeAll,
}: {
  shelf: SeriesShelf;
  style: StyleProp<ViewStyle>;
  toItem: (series: SeriesListItem) => HubRowItem;
  onSeeAll: (patch: Partial<SeriesFilters>) => void;
}) {
  const query = useSeriesList(shelf.query ?? {}, { staleTime: BROWSE_STALE_TIME_MS });
  const items = useMemo(() => (query.data?.items ?? []).slice(0, ROW_LIMIT).map(toItem), [query.data, toItem]);
  const seeAll = shelf.seeAll;
  return (
    <HubRow
      style={style}
      title={shelf.title}
      subtitle={shelf.subtitle}
      items={items}
      loading={query.isLoading}
      onSeeAll={seeAll ? () => onSeeAll(seeAll) : undefined}
    />
  );
});

const NO_SHELVES: SeriesShelf[] = [];
const shelfKey = (shelf: SeriesShelf) => shelf.key;
const seriesKey = (series: SeriesListItem) => series.id;
const renderSkeletonCell = (width: number) => <PosterCellSkeleton width={width} />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  fill: { flex: 1 },
  firstShelf: { marginTop: 10 },
  shelf: { marginTop: HUB_SECTION_GAP },
});

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  countMovieFilters,
  countSeriesFilters,
  movieLanguagePick,
  seriesLanguagePick,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/filters";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";

type Updater<F> = (prev: F) => F;

/** What an opening of the results view says besides the filters. */
export interface OpenOptions {
  /**
   * The language of the Language tile this view was opened from (the
   * Categories pop-up), or none. Only that pick sets it — every other opening
   * (another tile, a shelf's See all) clears it — so a language set in Sort &
   * filter is never mistaken for the tile's pick (movieLanguagePick).
   */
  languageTile?: string | null;
}

/**
 * One Media chip's two views, the Netflix way — BROWSE (the hero and the
 * shelves) and RESULTS (a genre, a category, a shelf's "See all", or any
 * sort/filter: a grid that pages by itself) — over the shared filter store
 * (searchFiltersStore), which the search screen, the Sort & filter sheet and
 * the SearchFilters page read and write too.
 */
export interface MediaResults<F> {
  /**
   * The filters this chip lists with: the shared store while the chip is on
   * screen, held still while it is not. While the search screen (pushed over
   * the Media root) edits the same store for ITS results, a hidden grid
   * following along would send an unseen request for every change; back on
   * screen it catches up in the same render.
   */
  filters: F;
  /**
   * The results view is showing: it was opened (a pick in the Categories
   * overlay, a shelf's "See all") or a filter is active. Browse otherwise —
   * so a filter set anywhere (the search screen included) is never applied
   * out of sight.
   */
  showResults: boolean;
  /**
   * The Language tile's pick the view shows (movieLanguagePick), or null: it
   * names the view rather than refining it. It ends for good once the
   * filters no longer hold that one language alone (Sort & filter, the
   * search screen, another pick, the ✕).
   */
  languagePick: string | null;
  /** Opens the results view, applying `update` to the shared filters. */
  open: (update: Updater<F>, options?: OpenOptions) => void;
  /** Back to browse: every filter of this kind cleared (the chip row's ✕). */
  close: () => void;
  /** Writes the shared filters, staying in the results view (a chip's ✕, Clear all). */
  update: (update: Updater<F>) => void;
}

function useHeld<F>(live: F, active: boolean): F {
  const [held, setHeld] = useState(live);
  if (active && held !== live) setHeld(live);
  return active ? live : held;
}

/**
 * Relevance only means something with a search term, and the Media page
 * never has one. The search screen puts the sort back when it closes; until
 * then (its pop animation) the Media page reads it as the default, so the
 * page never flickers into a "Relevance" view.
 */
function withoutRelevance<F extends { sort: string }>(f: F, fallback: F["sort"]): F {
  return f.sort === "relevance" ? { ...f, sort: fallback } : f;
}

export function useMovieResults(active: boolean): MediaResults<MovieFilters> {
  const live = useSearchFiltersStore((state) => state.movieFilters);
  const setFilters = useSearchFiltersStore((state) => state.setMovieFilters);
  const resetFilters = useSearchFiltersStore((state) => state.resetMovieFilters);
  const normalized = useMemo(() => withoutRelevance(live, DEFAULT_MOVIE_SORT), [live]);
  const filters = useHeld(normalized, active);
  const [opened, setOpened] = useState(false);
  const [languageTile, setLanguageTile] = useState<string | null>(null);

  const open = useCallback(
    (update: Updater<MovieFilters>, options: OpenOptions = {}) => {
      // The store first: any render that sees the new tile sees its filters too.
      setFilters(update);
      setLanguageTile(options.languageTile ?? null);
      setOpened(true);
    },
    [setFilters],
  );
  const close = useCallback(() => {
    resetFilters();
    setLanguageTile(null);
    setOpened(false);
  }, [resetFilters]);

  const languagePick = movieLanguagePick(filters, languageTile);
  // The filters moved on from the tile's lone language (Sort & filter, the
  // search screen): its pick is over, and the same language set again later
  // is a plain refinement.
  if (active && languageTile !== null && languagePick === null) setLanguageTile(null);

  const showResults = opened || countMovieFilters(filters) > 0;
  // Shown because a filter arrived from elsewhere (the search screen): from
  // here on it is an open results view like any other, so removing its last
  // chip leaves "All …" on screen rather than jumping back to browse.
  if (active && showResults && !opened) setOpened(true);
  return useMemo(
    () => ({ filters, showResults, languagePick, open, close, update: setFilters }),
    [filters, showResults, languagePick, open, close, setFilters],
  );
}

/**
 * The Series chip's two views, plus the admin category its results are
 * narrowed to. The category is kept out of the shared store on purpose: the
 * search screen, the Sort & filter sheet's count and the SearchFilters page
 * all send the store to the server, and none of them shows or clears a
 * series category, so it would narrow them out of sight. It is this Media
 * page's own state instead — set by a pick in the Categories pop-up, sent
 * by SeriesHubContent as GET /series?categoryId=, and cleared with the rest
 * of the view: the chip row's ✕, Android's back, any other pick ("All
 * series", a genre, a language) and every shelf's See all.
 */
export interface SeriesMediaResults extends MediaResults<SeriesFilters> {
  /** The admin category the results show (GET /categories), or null. */
  categoryId: string | null;
  /** Opens the results view: `update` on the shared filters, and the category — none unless one is given. */
  open: (update: Updater<SeriesFilters>, options?: OpenOptions & { categoryId?: string | null }) => void;
  /** Narrows the open results view to a category, or (null) back to every series. */
  setCategoryId: (categoryId: string | null) => void;
}

export function useSeriesResults(active: boolean): SeriesMediaResults {
  const live = useSearchFiltersStore((state) => state.seriesFilters);
  const setFilters = useSearchFiltersStore((state) => state.setSeriesFilters);
  const resetFilters = useSearchFiltersStore((state) => state.resetSeriesFilters);
  const normalized = useMemo(() => withoutRelevance(live, DEFAULT_SERIES_SORT), [live]);
  const filters = useHeld(normalized, active);
  const [opened, setOpened] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [languageTile, setLanguageTile] = useState<string | null>(null);

  const open = useCallback(
    (update: Updater<SeriesFilters>, options: OpenOptions & { categoryId?: string | null } = {}) => {
      // The store first: any render that sees the new tile sees its filters too.
      setFilters(update);
      setCategoryId(options.categoryId ?? null);
      setLanguageTile(options.languageTile ?? null);
      setOpened(true);
    },
    [setFilters],
  );
  const close = useCallback(() => {
    resetFilters();
    setCategoryId(null);
    setLanguageTile(null);
    setOpened(false);
  }, [resetFilters]);

  const languagePick = seriesLanguagePick(filters, categoryId, languageTile);
  // The filters moved on from the tile's lone language: its pick is over (see useMovieResults).
  if (active && languageTile !== null && languagePick === null) setLanguageTile(null);

  // A category is only ever set by `open`, so it never shows without `opened`.
  const showResults = opened || countSeriesFilters(filters) > 0;
  // Shown because a filter arrived from elsewhere (the search screen): from
  // here on it is an open results view like any other, so removing its last
  // chip leaves "All …" on screen rather than jumping back to browse.
  if (active && showResults && !opened) setOpened(true);
  return useMemo(
    () => ({ filters, showResults, languagePick, open, close, update: setFilters, categoryId, setCategoryId }),
    [filters, showResults, languagePick, open, close, setFilters, categoryId],
  );
}

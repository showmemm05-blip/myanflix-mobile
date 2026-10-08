import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_MOVIE_SORT,
  DEFAULT_SERIES_SORT,
  countMovieFilters,
  countSeriesFilters,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/filters";
import { useSearchFiltersStore } from "@/store/searchFiltersStore";

type Updater<F> = (prev: F) => F;

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
  /** Opens the results view, applying `update` to the shared filters. */
  open: (update: Updater<F>) => void;
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

  const open = useCallback(
    (update: Updater<MovieFilters>) => {
      setFilters(update);
      setOpened(true);
    },
    [setFilters],
  );
  const close = useCallback(() => {
    resetFilters();
    setOpened(false);
  }, [resetFilters]);

  const showResults = opened || countMovieFilters(filters) > 0;
  // Shown because a filter arrived from elsewhere (the search screen): from
  // here on it is an open results view like any other, so removing its last
  // chip leaves "All …" on screen rather than jumping back to browse.
  if (active && showResults && !opened) setOpened(true);
  return useMemo(
    () => ({ filters, showResults, open, close, update: setFilters }),
    [filters, showResults, open, close, setFilters],
  );
}

/**
 * The Series chip's two views, plus the admin category its results are
 * narrowed to. GET /series has NO categoryId filter, so the category is not
 * a wire filter and is kept out of the shared store on purpose: the search
 * screen, the Sort & filter sheet's count and the SearchFilters page all
 * send the store to the server, which would list (or count) every series
 * under it. It is this Media page's own state instead — set by a pick in the
 * Categories overlay, applied on the client over the loaded pages
 * (SeriesHubContent, the way CategoryDetail filters its Series tab), and
 * cleared with the rest of the view: the chip row's ✕, Android's back, any
 * other pick ("All series", a genre) and every shelf's See all.
 */
export interface SeriesMediaResults extends MediaResults<SeriesFilters> {
  /** The admin category the results show (GET /categories), or null. */
  categoryId: string | null;
  /** Opens the results view: `update` on the shared filters, and the category — none unless one is given. */
  open: (update: Updater<SeriesFilters>, categoryId?: string | null) => void;
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

  const open = useCallback(
    (update: Updater<SeriesFilters>, nextCategoryId: string | null = null) => {
      setFilters(update);
      setCategoryId(nextCategoryId);
      setOpened(true);
    },
    [setFilters],
  );
  const close = useCallback(() => {
    resetFilters();
    setCategoryId(null);
    setOpened(false);
  }, [resetFilters]);

  // A category is only ever set by `open`, so it never shows without `opened`.
  const showResults = opened || countSeriesFilters(filters) > 0;
  // Shown because a filter arrived from elsewhere (the search screen): from
  // here on it is an open results view like any other, so removing its last
  // chip leaves "All …" on screen rather than jumping back to browse.
  if (active && showResults && !opened) setOpened(true);
  return useMemo(
    () => ({ filters, showResults, open, close, update: setFilters, categoryId, setCategoryId }),
    [filters, showResults, open, close, setFilters, categoryId],
  );
}

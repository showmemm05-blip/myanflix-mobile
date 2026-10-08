import { create } from "zustand";
import {
  createMovieFilters,
  createSeriesFilters,
  type MovieFilters,
  type SeriesFilters,
} from "@/components/search/filters";

/** A value or a React-style updater — the Search screen's relevance guard needs the latter. */
type Updater<T> = T | ((prev: T) => T);

interface SearchFiltersState {
  movieFilters: MovieFilters;
  seriesFilters: SeriesFilters;
  setMovieFilters: (next: Updater<MovieFilters>) => void;
  setSeriesFilters: (next: Updater<SeriesFilters>) => void;
  resetMovieFilters: () => void;
  resetSeriesFilters: () => void;
}

function resolve<T>(next: Updater<T>, prev: T): T {
  return typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
}

/**
 * THE filter state of the Media tab — one object per filterable tab, shared
 * by the Media root's Movies / Series results views and the search screen
 * (which send it to the backend), the Categories overlay (the genre or
 * category), the Sort & filter sheet and the SearchFilters page (which edit
 * a draft and commit it here). Nothing travels through navigation params, so
 * they can never disagree.
 *
 * Not persisted, on purpose: filters are a question about THIS visit, and a
 * cold start should open on the plain catalogue.
 */
export const useSearchFiltersStore = create<SearchFiltersState>((set) => ({
  movieFilters: createMovieFilters(),
  seriesFilters: createSeriesFilters(),
  setMovieFilters: (next) => set((state) => ({ movieFilters: resolve(next, state.movieFilters) })),
  setSeriesFilters: (next) => set((state) => ({ seriesFilters: resolve(next, state.seriesFilters) })),
  resetMovieFilters: () => set({ movieFilters: createMovieFilters() }),
  resetSeriesFilters: () => set({ seriesFilters: createSeriesFilters() }),
}));

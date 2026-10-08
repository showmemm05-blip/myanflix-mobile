import { useMemo, useState } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useWatchlist } from "@/hooks/useWatchlist";
import { moviesService } from "@/services/movies.service";
import { seriesService } from "@/services/series.service";
import type { PaginatedResponse } from "@/types/api";
import type { AccessType, Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

/**
 * Saved favourites are asked for BY ID: the same id list goes to
 * GET /movies?ids= and GET /series?ids= (the phone does not record which kind
 * an id is), and each answers only its own PUBLISHED titles. So only the
 * saved titles are downloaded, and an old favourite is found however many
 * newer titles were published since (the old way read the 100 newest of each
 * and filtered them on the phone).
 *
 * The server takes at most 100 ids per request (its page-size cap), so a
 * longer list is split into chunks of 100. Every reader here uses the same
 * keys — the SORTED id chunk — so Profile's "Your library" group and the
 * Favorites screen share one cache entry per chunk.
 */
export const FAVORITES_CHUNK_SIZE = 100;

/** What the backend's `@IsUUID('4')` accepts: one bad id would 400 its whole chunk. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FAVORITES_STALE_TIME_MS = 60_000;

/** The saved ids that can be asked for, sorted (key independent of save order), in chunks of 100. */
export function favoriteIdChunks(ids: readonly string[] | undefined): string[][] {
  const askable = [...new Set((ids ?? []).filter((id) => UUID_V4.test(id)))].sort();
  const chunks: string[][] = [];
  for (let i = 0; i < askable.length; i += FAVORITES_CHUNK_SIZE) {
    chunks.push(askable.slice(i, i + FAVORITES_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Under ["movies"] / ["series"] so every pull-to-refresh that invalidates the
 * catalogue reaches them; "favorites" is never an id, so no other key matches.
 */
export const favoriteMoviesKey = (chunk: readonly string[]) => ["movies", "favorites", chunk] as const;
export const favoriteSeriesKey = (chunk: readonly string[]) => ["series", "favorites", chunk] as const;

export interface FavoriteCatalogPart<T> {
  items: T[];
  /** Every chunk has an answer (false while any is disabled or pending). */
  hasData: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

/** Module-level so React Query re-runs it only when a chunk's answer changes. */
function combinePages<T>(results: UseQueryResult<PaginatedResponse<T>>[]): FavoriteCatalogPart<T> {
  return {
    items: results.flatMap((result) => result.data?.items ?? []),
    hasData: results.length > 0 && results.every((result) => result.data !== undefined),
    isLoading: results.some((result) => result.isLoading),
    isError: results.some((result) => result.isError),
    refetch: async () => {
      await Promise.all(results.map((result) => result.refetch()));
    },
  };
}
const combineMovies = combinePages<Movie>;
const combineSeries = combinePages<SeriesListItem>;

/**
 * Holds the last settled titles while a CHANGED id list is asked again (a
 * favourite removed or added changes the key). The readers filter by the
 * current saved ids anyway, so a removed title still disappears at once —
 * as it did when the key never changed — instead of the grid flashing back
 * to skeletons for a list it already had.
 */
function useHeldOver<T>(part: FavoriteCatalogPart<T>): FavoriteCatalogPart<T> {
  const [held, setHeld] = useState<T[] | null>(null);
  // Only a real answer is held — never the empty list of a query that is
  // still switched off (the Favorites screen's Series tab before it opens),
  // or that would read as "no favourites" instead of loading.
  if (part.hasData && held !== part.items) setHeld(part.items);
  if (part.isLoading && held) return { ...part, items: held, isLoading: false };
  return part;
}

/**
 * The saved titles of both kinds, fetched by id. `enabled` lets the
 * Favorites screen ask for series only once its Series tab is open.
 */
export function useFavoriteCatalog(
  ids: readonly string[] | undefined,
  enabled: { movies: boolean; series: boolean } = { movies: true, series: true },
) {
  const chunks = useMemo(() => favoriteIdChunks(ids), [ids]);
  const movies = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: favoriteMoviesKey(chunk),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        moviesService.getMovies({ ids: chunk, limit: chunk.length }, { signal }),
      enabled: enabled.movies,
      staleTime: FAVORITES_STALE_TIME_MS,
    })),
    combine: combineMovies,
  });
  const series = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: favoriteSeriesKey(chunk),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        seriesService.getSeries({ ids: chunk, limit: chunk.length }, { signal }),
      enabled: enabled.series,
      staleTime: FAVORITES_STALE_TIME_MS,
    })),
    combine: combineSeries,
  });
  return { movies: useHeldOver(movies), series: useHeldOver(series) };
}

export type FavoriteKind = "movie" | "series";

export interface FavoriteTitle {
  kind: FavoriteKind;
  id: string;
  title: string;
  posterUrl: string | null;
  coverUrl: string | null;
  accessType: AccessType;
  releaseYear: number;
  rating: number;
  /**
   * Where the id sits in the saved list. Ids are appended as they are saved
   * and no timestamp exists, so a higher number means "saved more recently".
   */
  savedOrder: number;
  movie?: Movie;
  series?: SeriesListItem;
}

export function fromMovie(movie: Movie, savedOrder: number): FavoriteTitle {
  return {
    kind: "movie",
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterUrl,
    coverUrl: movie.coverUrl,
    accessType: movie.accessType,
    releaseYear: movie.releaseYear,
    rating: movie.rating,
    savedOrder,
    movie,
  };
}

export function fromSeries(series: SeriesListItem, savedOrder: number): FavoriteTitle {
  return {
    kind: "series",
    id: series.id,
    title: series.title,
    posterUrl: series.posterUrl,
    coverUrl: series.coverUrl,
    accessType: series.accessType,
    releaseYear: series.releaseYear,
    rating: series.rating,
    savedOrder,
    series,
  };
}

/** id → its position in the saved list. */
export function savedOrderOf(ids: readonly string[]): Map<string, number> {
  return new Map(ids.map((id, index) => [id, index]));
}

/**
 * Device favourites resolved to titles, MOST RECENTLY SAVED FIRST, for the
 * Favorites row on Profile. Nothing is asked until at least one id is saved —
 * an empty list costs no request at all.
 */
export function useFavoriteTitles() {
  const watchlistQuery = useWatchlist();
  const ids = watchlistQuery.data;
  const { movies, series } = useFavoriteCatalog(ids);

  const titles = useMemo<FavoriteTitle[]>(() => {
    if (!ids || ids.length === 0) return [];
    const order = savedOrderOf(ids);
    const found: FavoriteTitle[] = [];
    for (const movie of movies.items) {
      const at = order.get(movie.id);
      if (at !== undefined) found.push(fromMovie(movie, at));
    }
    for (const item of series.items) {
      const at = order.get(item.id);
      if (at !== undefined) found.push(fromSeries(item, at));
    }
    return found.sort((a, b) => b.savedOrder - a.savedOrder);
  }, [ids, movies.items, series.items]);

  return {
    /** How many ids this phone has saved — the count the screens show. */
    savedCount: ids?.length ?? 0,
    titles,
    /** True until the ids, and (when there are any) both kinds' titles, have answered. */
    isLoading: watchlistQuery.isLoading || movies.isLoading || series.isLoading,
    isError: watchlistQuery.isError || movies.isError || series.isError,
    /**
     * Asks again (Profile's pull-to-refresh and its Retry): the saved ids and
     * the saved titles. With no ids there are no title queries to refetch.
     */
    refetch: async () => {
      await Promise.all([watchlistQuery.refetch(), movies.refetch(), series.refetch()]);
    },
  };
}

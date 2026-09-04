import { formatDuration } from "@/utils/format";
import type { MediaCardProps } from "@/components/common/MediaCard";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

/**
 * The subset of MediaCard props derived from a catalogue record. Every list of
 * titles in the app (rails, grids, search results) goes through these mappers
 * so a movie looks identical wherever it appears.
 */
export type MediaCardContent = Pick<
  MediaCardProps,
  "title" | "posterUrl" | "coverUrl" | "accessType" | "rating" | "meta"
>;

/**
 * Movie → card. Web meta parity: rated → "year · ★x.x" (the star renders via
 * the card's `rating` prop), unrated → "year · runtime". The backend stores
 * unrated as 0, so 0 is normalised to null here.
 */
export function movieCardContent(movie: Movie): MediaCardContent {
  const rating = movie.rating > 0 ? movie.rating : null;
  return {
    title: movie.title,
    posterUrl: movie.posterUrl ?? movie.coverUrl,
    coverUrl: movie.coverUrl ?? movie.posterUrl,
    accessType: movie.accessType,
    rating,
    meta: rating !== null ? [movie.releaseYear] : [movie.releaseYear, formatDuration(movie.duration)],
  };
}

/**
 * Series → card: "year · {n} episodes". `episodesLabel` is passed in already
 * translated (`t.series.episodeCount`) so this stays free of localization
 * imports.
 */
export function seriesCardContent(series: SeriesListItem, episodesLabel: string): MediaCardContent {
  return {
    title: series.title,
    posterUrl: series.posterUrl ?? series.coverUrl,
    coverUrl: series.coverUrl ?? series.posterUrl,
    accessType: series.accessType,
    rating: null,
    meta: [series.releaseYear, episodesLabel],
  };
}

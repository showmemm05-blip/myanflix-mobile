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
  "title" | "imageUrl" | "posterUrl" | "accessType" | "rating" | "meta"
>;

/** Movie → card: 16:9 cover (poster as fallback), year · runtime · genre. */
export function movieCardContent(movie: Movie): MediaCardContent {
  return {
    title: movie.title,
    imageUrl: movie.coverUrl ?? movie.posterUrl,
    posterUrl: movie.posterUrl,
    accessType: movie.accessType,
    rating: movie.rating,
    meta: [movie.releaseYear, formatDuration(movie.duration), movie.genre],
  };
}

/**
 * Series → card. `episodesLabel` is passed in already translated
 * (`t.series.episodeCount`) so this stays free of localization imports.
 */
export function seriesCardContent(series: SeriesListItem, episodesLabel: string): MediaCardContent {
  return {
    title: series.title,
    imageUrl: series.coverUrl ?? series.posterUrl,
    posterUrl: series.posterUrl,
    accessType: series.accessType,
    meta: [series.releaseYear, episodesLabel, series.genre],
  };
}

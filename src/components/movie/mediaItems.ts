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
  "title" | "posterUrl" | "coverUrl" | "accessType" | "rating" | "meta" | "genre" | "qualityLabel"
>;

/**
 * The only rendition names this platform produces (backend RENDITION_TIERS),
 * mapped to what a badge should say. 2160p is listed for the day the ladder
 * grows — it is data-driven, never assumed, so "4K" can only ever appear if
 * the API genuinely reports that rendition. Anything unrecognised badges
 * nothing rather than printing a raw field at the user.
 */
const QUALITY_BADGES: Record<string, string> = {
  "240p": "240p",
  "360p": "360p",
  "480p": "480p",
  "720p": "720p",
  "1080p": "1080p",
  "2160p": "4K",
};

/** Reported rendition → badge text, or null when there is nothing honest to show. */
export function qualityBadgeLabel(reported: string | null | undefined): string | null {
  if (!reported) return null;
  return QUALITY_BADGES[reported.trim().toLowerCase()] ?? null;
}

export interface MovieCardOptions {
  /**
   * Adds the genre as a third line under the meta row. Off by default because
   * a rail card is 160pt wide and already carries two lines — only the search
   * grid, whose cells are roughly twice that, has the room for it.
   */
  showGenre?: boolean;
}

/**
 * Movie → card. Web meta parity: rated → "year · ★x.x" (the star renders via
 * the card's `rating` prop), unrated → "year · runtime". The backend stores
 * unrated as 0, so 0 is normalised to null here.
 */
export function movieCardContent(movie: Movie, options: MovieCardOptions = {}): MediaCardContent {
  const rating = movie.rating > 0 ? movie.rating : null;
  return {
    title: movie.title,
    posterUrl: movie.posterUrl ?? movie.coverUrl,
    coverUrl: movie.coverUrl ?? movie.posterUrl,
    accessType: movie.accessType,
    rating,
    meta: rating !== null ? [movie.releaseYear] : [movie.releaseYear, formatDuration(movie.duration)],
    // `genre` is a single required column on the catalogue row, not a list —
    // an empty string is possible on older records, so fall back to nothing
    // rather than reserving a blank line.
    genre: options.showGenre && movie.genre ? movie.genre : null,
    // Straight from the API's reported rendition — null until a title has
    // finished transcoding, which is a badge-less card, not a guessed one.
    qualityLabel: qualityBadgeLabel(movie.maxQuality),
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

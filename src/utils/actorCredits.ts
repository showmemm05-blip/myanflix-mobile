import type { TranslationShape } from "@/localization/translations";

/** The two backend totals every actor row carries (see ActorListItem). */
export interface ActorCredits {
  /** Standalone movies only — what GET /movies?actorIds= lists. */
  movieCount: number;
  /** Distinct series, on the show's cast or on any episode's — what GET /series?actorIds= lists. */
  seriesCount: number;
}

/**
 * The one credits caption under a person's name — "1 movie · 2 series" —
 * used by every ActorsList cell AND the actor page's hero, so the two never
 * word the same numbers differently. A zero part is left out ("2 series",
 * not "0 movies · 2 series"); when both are zero it says `actors.noTitles`.
 *
 * Takes the dictionary rather than calling useLanguage itself so it stays a
 * plain function usable inside memoized FlatList cells.
 */
export function actorCreditsCaption(t: TranslationShape, { movieCount, seriesCount }: ActorCredits): string {
  const parts: string[] = [];
  if (movieCount > 0) {
    parts.push(movieCount === 1 ? t.actors.moviesCountOne : t.actors.moviesCount.replace("{n}", String(movieCount)));
  }
  if (seriesCount > 0) {
    parts.push(seriesCount === 1 ? t.actors.seriesCountOne : t.actors.seriesCount.replace("{n}", String(seriesCount)));
  }
  return parts.length === 0 ? t.actors.noTitles : parts.join(t.actors.creditsJoiner);
}

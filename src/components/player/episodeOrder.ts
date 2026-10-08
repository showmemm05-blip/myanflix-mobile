import type { PlayerEpisode, PlayerSeasonGroup } from "@/types/series";

/** One episode with the season it belongs to — the order the player walks. */
export interface OrderedEpisode {
  episode: PlayerEpisode;
  seasonNumber: number;
}

/**
 * Every episode of the series in the order `usePlayerEpisodes` returns them:
 * season groups as the API lists them, episodes as each group lists them.
 * Nothing is re-sorted here — the backend owns the order, exactly as the
 * episode list under the player has always shown it.
 */
export function flattenEpisodes(seasons: PlayerSeasonGroup[] | undefined): OrderedEpisode[] {
  if (!seasons) return [];
  const ordered: OrderedEpisode[] = [];
  for (const season of seasons) {
    for (const episode of season.episodes) ordered.push({ episode, seasonNumber: season.seasonNumber });
  }
  return ordered;
}

/**
 * The episode after `currentEpisodeId` in that order, or null when there is
 * none: the current one is the last, or it is not in the list at all (a film,
 * an episode the list does not carry). Null hides the Next-episode control.
 */
export function findNextEpisode(
  seasons: PlayerSeasonGroup[] | undefined,
  currentEpisodeId: string,
): OrderedEpisode | null {
  const ordered = flattenEpisodes(seasons);
  const index = ordered.findIndex((item) => item.episode.id === currentEpisodeId);
  if (index < 0 || index >= ordered.length - 1) return null;
  return ordered[index + 1];
}

/** "S1 · E3", the same tag the player has always shown under a title; null without numbers. */
export function episodeTag(seasonNumber: number | null | undefined, episodeNumber: number | null | undefined): string | null {
  if (!seasonNumber || !episodeNumber) return null;
  return `S${seasonNumber} · E${episodeNumber}`;
}

/**
 * "S1 · E3 · Teashop at Dawn" — what the Next-episode control shows under its
 * label and says aloud. An untitled episode falls back to the series strings'
 * "Episode {n}", as the episode rows do.
 */
export function describeEpisode(item: OrderedEpisode, fallbackTitle: string): string {
  const number = item.episode.episodeNumber;
  const title =
    item.episode.title.trim().length > 0
      ? item.episode.title
      : fallbackTitle.replace("{n}", number != null ? String(number) : "—");
  const tag = episodeTag(item.seasonNumber, number);
  return tag ? `${tag} · ${title}` : title;
}

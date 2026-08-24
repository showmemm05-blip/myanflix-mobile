import type { SubtitleTrack } from "expo-video";

/**
 * Helpers for the subtitle renditions expo-video discovers inside the HLS
 * master playlist (`#EXT-X-MEDIA:TYPE=SUBTITLES`). The player cannot side-load
 * an external file, so everything here works off `availableSubtitleTracks`.
 *
 * Two facts drive the shape of this module:
 *  - the player hands back FRESHLY CONSTRUCTED track objects on every
 *    `availableSubtitleTracksChange` / `sourceLoad`, so identity comparison is
 *    useless and every "did this change?" check has to be by value;
 *  - `SubtitleTrack.id` is documented Android-only, so it can never be the sole
 *    key — language + label are compared alongside it.
 */

export function isSameSubtitleTrack(a: SubtitleTrack | null, b: SubtitleTrack | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.language === b.language && a.label === b.label;
}

export function isSameSubtitleTrackList(a: SubtitleTrack[], b: SubtitleTrack[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((track, index) => isSameSubtitleTrack(track, b[index] ?? null));
}

/**
 * Row text for the picker. The manifest's `NAME` normally arrives as `label`,
 * but a track can report an empty one, and a blank row would be unpickable.
 */
export function subtitleTrackLabel(track: SubtitleTrack): string {
  const label = track.label?.trim();
  if (label) return label;
  const language = track.language?.trim();
  return language ? language.toUpperCase() : "—";
}

/**
 * The short badge on the control while a track is on — "EN", "MY". iOS reports
 * the language as a full locale identifier, so a region-qualified `en-US` has
 * to lose its suffix rather than badge itself "EN-".
 */
export function subtitleTrackTag(track: SubtitleTrack): string {
  const language = track.language?.trim();
  const source = language ? language.split(/[-_]/)[0] : subtitleTrackLabel(track);
  return source.slice(0, 3).toUpperCase();
}

/**
 * What gets remembered when the viewer picks a track. A language, not an id:
 * ids are per-title (and Android-only), whereas "give me the English track"
 * is the choice that should carry to the next episode. Falls back to the label
 * for the rare rendition that declares no LANGUAGE at all.
 */
export function subtitleTrackKey(track: SubtitleTrack): string | null {
  return track.language?.trim() || track.label?.trim() || null;
}

/**
 * Resolves a remembered key against what THIS title actually offers. Returns
 * null when the title has no matching rendition — the preference is
 * deliberately left stored so it re-applies on the next title that does.
 * `en` matches a manifest that declares `en-US`, and vice versa.
 */
export function findSubtitleTrackByLanguage(
  tracks: SubtitleTrack[],
  language: string | null,
): SubtitleTrack | null {
  if (!language) return null;
  const wanted = language.trim().toLowerCase();
  if (!wanted) return null;
  const base = wanted.split(/[-_]/)[0];
  return (
    tracks.find((track) => track.language?.trim().toLowerCase() === wanted) ??
    tracks.find((track) => track.language?.trim().toLowerCase().split(/[-_]/)[0] === base) ??
    tracks.find((track) => track.label?.trim().toLowerCase() === wanted) ??
    null
  );
}

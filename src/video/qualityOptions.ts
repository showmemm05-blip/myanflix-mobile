import type { StreamQuality } from "@/types/video";

/**
 * Which playlist should be mounted, given the ladder this title offers and the
 * viewer's remembered choice.
 *
 * It exists as one pure function because the question is asked in more than one
 * place — the initial pin, and the error paths that adopt a freshly signed
 * response — and two answers to it is exactly how the badge on the control ends
 * up claiming a quality that is not playing.
 *
 * A label this title does not have resolves to the master and the preference is
 * deliberately LEFT STORED, the same rule `findSubtitleTrackByLanguage` follows
 * for languages: an episode without a 720p rung plays Auto, and 720p comes back
 * on the next one that has it rather than being silently forgotten.
 */
export function resolveQualityUrl(
  masterUrl: string,
  qualities: StreamQuality[],
  label: string | null,
): string {
  if (label === null) return masterUrl;
  return qualities.find((q) => q.label === label)?.url ?? masterUrl;
}

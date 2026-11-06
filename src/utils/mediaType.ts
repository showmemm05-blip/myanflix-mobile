import type { TranslationShape } from "@/localization/translations";

type TypeWord = keyof TranslationShape["mediaType"]["names"];

/**
 * A movie's or series' TYPE as the viewer reads it — "Korean movie",
 * "ကိုရီးယား ဇာတ်လမ်းတွဲ" — from the plain word the admin picked (owner,
 * 2026-10-27), which the API sends as `country`. null when there is nothing
 * worth saying: no type, or "Other". A word this app does not know yet
 * shows as itself ("Turkish movie") rather than disappearing.
 */
export function mediaTypeLabel(
  t: TranslationShape,
  word: string | null | undefined,
  kind: "movie" | "series",
): string | null {
  const trimmed = word?.trim();
  if (!trimmed || trimmed === "Other") return null;
  const name = t.mediaType.names[trimmed as TypeWord] ?? trimmed;
  return t.mediaType[kind].replace("{type}", name);
}

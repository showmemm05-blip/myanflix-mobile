import type { Language } from "@/localization/translations";

/**
 * A movie's, episode's or series' description in the reader's language
 * (owner, 2026-11-06). The API always sends both texts: `description` is the
 * English / default one (TMDB's, or typed by staff) and `descriptionMm` the
 * Burmese one staff add by hand, at any time.
 *
 * Burmese app: the Burmese text, or the English one when none was added, so
 * the page is never blank. English app: the English text, or the Burmese one
 * when that is all a title has (one language is enough). A missing
 * `descriptionMm` — an older backend, or a book on a Home card — counts as an
 * empty one. "" when the title has no description at all.
 *
 * The same rule as the website's lib/localized-description.ts, and as
 * `promoText` (components/home/homeData) for the Home promos. The language is
 * read when the text is drawn, so switching it needs no refetch and no new
 * cache key.
 */
export function localizedDescription(
  item: { description?: string | null; descriptionMm?: string | null },
  language: Language,
): string {
  const en = (item.description ?? "").trim();
  const mm = (item.descriptionMm ?? "").trim();
  return language === "mm" ? mm || en : en || mm;
}

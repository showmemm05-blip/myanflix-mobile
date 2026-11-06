// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Type-only here, but
// the rule is the same. Don't "tidy" it back.
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { HubKind } from "@/components/hub/hubLayout";
import type { TranslationShape } from "@/localization/translations";
import type { SearchStackParamList } from "@/navigation/types";

/** What the Media tab can show: one of the three hubs, or Music (coming soon). */
export type MediaSection = HubKind | "music";

/** What a section page is asked to open (navigation/types: Search.initialTab). */
type RequestedSection = NonNullable<NonNullable<SearchStackParamList["Search"]>["initialTab"]>;

/** One glyph per section — the hub's cards (MediaSectionCard). */
export const SECTION_ICON: Record<MediaSection, keyof typeof Ionicons.glyphMap> = {
  movies: "film-outline",
  series: "tv-outline",
  books: "book-outline",
  music: "musical-notes-outline",
};

/** "all" is the search screen's word; the Media tab has no All section, so it opens on Movies. */
export function sectionFor(requested: RequestedSection | undefined): MediaSection {
  return !requested || requested === "all" ? "movies" : requested;
}

/** The section's name as the search pills spell it. */
export function sectionLabel(t: TranslationShape, section: MediaSection): string {
  switch (section) {
    case "series":
      return t.search.series;
    case "books":
      return t.search.books;
    case "music":
      return t.search.music;
    case "movies":
    default:
      return t.search.movies;
  }
}

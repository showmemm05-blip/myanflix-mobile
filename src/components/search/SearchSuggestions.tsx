import type { RefObject } from "react";
import type { View } from "react-native";
import { BookSuggestions } from "@/components/search/suggestions/BookSuggestions";
import { MovieSuggestions } from "@/components/search/suggestions/MovieSuggestions";
import { SeriesSuggestions } from "@/components/search/suggestions/SeriesSuggestions";
import type { Book } from "@/types/book";
import type { Movie } from "@/types/movie";
import type { SeriesListItem } from "@/types/series";

/** Which catalogue the panel lists. Music has none, hence the screen's `null`. */
export type SuggestKind = "movies" | "series" | "books";

interface Props {
  /**
   * The RAW field value, every keystroke. Each panel debounces it ITSELF, in
   * its own state — none of them reads or writes the grid's settled term.
   */
  term: string;
  /** Focused, long enough, and on a tab whose rows can honestly answer. */
  visible: boolean;
  /** Which catalogue to list; `null` on Music, where there is nothing to list. */
  kind: SuggestKind | null;
  /** The search field's outer view — measured to find its bottom edge. */
  anchorRef: RefObject<View | null>;
  /** The screen's root view — the panel's own coordinate space. */
  containerRef: RefObject<View | null>;
  /** The screen closes the panel, records the search and navigates. */
  onSelectMovie: (movie: Movie) => void;
  onSelectSeries: (series: SeriesListItem) => void;
  onSelectBook: (book: Book) => void;
  /**
   * The footer row, shared by all three. The grid below does NOT follow the
   * typing, so this is one of only three ways a typed term ever reaches it (the
   * others being the keyboard's search key and a recent-search chip). The
   * screen commits the term, closes the panel and dismisses the keyboard.
   */
  onSeeAll: () => void;
}

/**
 * The search field's suggestion panel — one element on the screen, three
 * catalogues behind it.
 *
 * The screen renders this once and says which kind the current tab holds; the
 * box, the motion and every state live in SuggestionPanel, and the per-kind
 * wrappers supply only their query, their rows and their destination.
 *
 * WHY all three are rendered rather than `kind === "movies" ? <A/> : <B/>`: the
 * panel's exit animation depends on the component OUTLIVING `visible` (see
 * SuggestionPanel's `mounted`). Swapping components on a tab change would hard
 * unmount an open panel instead of animating it away. The two idle wrappers
 * render nothing and their queries are disabled, so nothing reaches the wire.
 */
export function SearchSuggestions({
  term,
  visible,
  kind,
  anchorRef,
  containerRef,
  onSelectMovie,
  onSelectSeries,
  onSelectBook,
  onSeeAll,
}: Props) {
  return (
    <>
      <MovieSuggestions
        term={term}
        visible={visible && kind === "movies"}
        anchorRef={anchorRef}
        containerRef={containerRef}
        onSelect={onSelectMovie}
        onSeeAll={onSeeAll}
      />
      <SeriesSuggestions
        term={term}
        visible={visible && kind === "series"}
        anchorRef={anchorRef}
        containerRef={containerRef}
        onSelect={onSelectSeries}
        onSeeAll={onSeeAll}
      />
      <BookSuggestions
        term={term}
        visible={visible && kind === "books"}
        anchorRef={anchorRef}
        containerRef={containerRef}
        onSelect={onSelectBook}
        onSeeAll={onSeeAll}
      />
    </>
  );
}

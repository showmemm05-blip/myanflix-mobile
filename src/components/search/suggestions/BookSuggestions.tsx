import { useMemo, type RefObject } from "react";
import type { View } from "react-native";
import { useBookSuggestions } from "@/hooks/useBooks";
import { useLanguage } from "@/localization/LanguageProvider";
import { SuggestionPanel } from "@/components/search/suggestions/SuggestionPanel";
import { BOOK_THUMB_WIDTH, SuggestionRow } from "@/components/search/suggestions/SuggestionRow";
import { useSuggestDebounce } from "@/components/search/suggestions/useSuggestDebounce";
import type { Book } from "@/types/book";

interface Props {
  /** The RAW field value, every keystroke — debounced here, not by the screen. */
  term: string;
  visible: boolean;
  anchorRef: RefObject<View | null>;
  containerRef: RefObject<View | null>;
  onSelect: (book: Book) => void;
  onSeeAll: () => void;
}

/**
 * The books panel. Same box, same debounce, same footer as movies; a 5:7 cover
 * instead of a 2:3 poster, and the author instead of "year · genre" — a Book
 * carries neither a release year nor a genre, and the author is the field the
 * search itself matched on half the time.
 */
export function BookSuggestions({ term, visible, anchorRef, containerRef, onSelect, onSeeAll }: Props) {
  const { t } = useLanguage();
  const debounced = useSuggestDebounce(term);
  const query = useBookSuggestions(debounced, visible);

  /**
   * Title matches first, everything else after, original order kept within each
   * group — a stable re-rank of the eight rows in hand.
   *
   * WHY it exists: /books takes no `sort` (see useBookSuggestions), so the
   * server answers newest-first and an exact title match can otherwise sit
   * under three books that merely mention the term in their description. WHY it
   * is only half a fix: it re-orders the window, it cannot widen it — a match
   * that is the ninth-newest is not in this page at all and no amount of
   * client-side sorting will bring it in. That needs a `sort` on the endpoint.
   */
  const items = useMemo(() => {
    const page = query.data?.items ?? [];
    if (!debounced) return page;
    const needle = debounced.toLowerCase();
    const titled = page.filter((book) => book.title.toLowerCase().includes(needle));
    if (titled.length === 0 || titled.length === page.length) return page;
    return [...titled, ...page.filter((book) => !book.title.toLowerCase().includes(needle))];
  }, [query.data, debounced]);

  return (
    <SuggestionPanel
      visible={visible}
      anchorRef={anchorRef}
      containerRef={containerRef}
      term={debounced}
      accessibilityLabel={t.search.suggestionsLabelBooks}
      emptyLabel={t.search.suggestNoResultsBooks.replace("{term}", debounced)}
      onSeeAll={onSeeAll}
      state={query}
      itemCount={items.length}
      thumbWidth={BOOK_THUMB_WIDTH}
    >
      {items.map((book) => (
        <SuggestionRow
          key={book.id}
          title={book.title}
          term={debounced}
          // A Book has ONE image field, so a missing cover goes straight to the
          // glyph — the same one BookCard falls back to.
          imageUrl={book.coverUrl}
          fallbackIcon="book-outline"
          thumbWidth={BOOK_THUMB_WIDTH}
          // Omitted when empty, exactly as the movies row omits an empty genre.
          meta={book.author || null}
          onPress={() => onSelect(book)}
        />
      ))}
    </SuggestionPanel>
  );
}

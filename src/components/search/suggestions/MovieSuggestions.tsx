import { useMemo, type RefObject } from "react";
import type { View } from "react-native";
import { useMovieSuggestions } from "@/hooks/useMovies";
import { useLanguage } from "@/localization/LanguageProvider";
import { SuggestionPanel } from "@/components/search/suggestions/SuggestionPanel";
import { POSTER_THUMB_WIDTH, SuggestionRow } from "@/components/search/suggestions/SuggestionRow";
import { useSuggestDebounce } from "@/components/search/suggestions/useSuggestDebounce";
import type { Movie } from "@/types/movie";

interface Props {
  /** The RAW field value, every keystroke — debounced here, not by the screen. */
  term: string;
  visible: boolean;
  anchorRef: RefObject<View | null>;
  /** Higher anchors for a short screen — see SuggestionPanel. */
  fallbackAnchorRefs?: ReadonlyArray<RefObject<View | null>>;
  /** Bumped by the screen when the anchor may have moved — see SuggestionPanel. */
  anchorKey?: number;
  containerRef: RefObject<View | null>;
  /** A tap on the dim behind the panel — see SuggestionPanel. */
  onDismiss?: () => void;
  onSelect: (movie: Movie) => void;
  onSeeAll: () => void;
}

/**
 * The movies panel — the one the other two are modelled on.
 *
 * All this wrapper owns is the movie vocabulary: the movies query, the poster
 * fallback chain, "year · genre", and a row press that opens MovieDetails.
 * Everything else — the box, the motion, the keyboard budget, the states and
 * the footer — is SuggestionPanel's, shared byte for byte with series and books.
 */
export function MovieSuggestions({
  term,
  visible,
  anchorRef,
  fallbackAnchorRefs,
  anchorKey,
  containerRef,
  onDismiss,
  onSelect,
  onSeeAll,
}: Props) {
  const { t } = useLanguage();
  const debounced = useSuggestDebounce(term);
  const query = useMovieSuggestions(debounced, visible);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <SuggestionPanel
      visible={visible}
      anchorRef={anchorRef}
      fallbackAnchorRefs={fallbackAnchorRefs}
      anchorKey={anchorKey}
      containerRef={containerRef}
      onDismiss={onDismiss}
      term={debounced}
      accessibilityLabel={t.search.suggestionsLabel}
      emptyLabel={t.search.suggestNoResults.replace("{term}", debounced)}
      onSeeAll={onSeeAll}
      state={query}
      itemCount={items.length}
      thumbWidth={POSTER_THUMB_WIDTH}
    >
      {items.map((movie) => (
        <MovieRow key={movie.id} movie={movie} term={debounced} onSelect={onSelect} />
      ))}
    </SuggestionPanel>
  );
}

function MovieRow({
  movie,
  term,
  onSelect,
}: {
  movie: Movie;
  term: string;
  onSelect: (movie: Movie) => void;
}) {
  // Both guards are real data states: releaseYear is 0 until the admin fills it
  // in, and genre is a required column that is empty on older records.
  const meta: string[] = [];
  if (movie.releaseYear > 0) meta.push(String(movie.releaseYear));
  if (movie.genre) meta.push(movie.genre);

  return (
    <SuggestionRow
      title={movie.title}
      term={term}
      // The same fallback every other surface uses — a movie with no poster
      // still has cover art often enough to be worth trying before the glyph.
      imageUrl={movie.posterUrl ?? movie.coverUrl}
      fallbackIcon="film-outline"
      thumbWidth={POSTER_THUMB_WIDTH}
      meta={meta.length > 0 ? meta.join(" · ") : null}
      onPress={() => onSelect(movie)}
    />
  );
}

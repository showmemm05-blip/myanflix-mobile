import { useMemo, type RefObject } from "react";
import type { View } from "react-native";
import { useSeriesSuggestions } from "@/hooks/useSeries";
import { useLanguage } from "@/localization/LanguageProvider";
import { SuggestionPanel } from "@/components/search/suggestions/SuggestionPanel";
import { POSTER_THUMB_WIDTH, SuggestionRow } from "@/components/search/suggestions/SuggestionRow";
import { useSuggestDebounce } from "@/components/search/suggestions/useSuggestDebounce";
import type { SeriesListItem } from "@/types/series";

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
  onSelect: (series: SeriesListItem) => void;
  onSeeAll: () => void;
}

/**
 * The series panel. Same box, same debounce, same footer as movies — only the
 * catalogue, the wording and the destination differ.
 *
 * Series posters ARE movie posters on this platform (seriesCardContent feeds
 * the same MediaCard), so the artwork keeps the 2:3 poster width.
 */
export function SeriesSuggestions({
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
  const query = useSeriesSuggestions(debounced, visible);
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
      accessibilityLabel={t.search.suggestionsLabelSeries}
      emptyLabel={t.search.suggestNoResultsSeries.replace("{term}", debounced)}
      onSeeAll={onSeeAll}
      state={query}
      itemCount={items.length}
      thumbWidth={POSTER_THUMB_WIDTH}
    >
      {items.map((series) => (
        <SeriesRow
          key={series.id}
          series={series}
          term={debounced}
          episodesLabel={
            series.episodeCount > 0 ? t.series.episodeCount.replace("{n}", String(series.episodeCount)) : null
          }
          onSelect={onSelect}
        />
      ))}
    </SuggestionPanel>
  );
}

function SeriesRow({
  series,
  term,
  episodesLabel,
  onSelect,
}: {
  series: SeriesListItem;
  term: string;
  /** Already translated, and null for a series with nothing published yet. */
  episodesLabel: string | null;
  onSelect: (series: SeriesListItem) => void;
}) {
  /**
   * "year · n episodes", NOT "year · genre". That is the vocabulary every
   * series card in the app already uses (see seriesCardContent) — genre is the
   * MOVIE card's second field — and a panel row that says "2019 · Drama" over a
   * card reading "2019 · 24 episodes" would be two vocabularies for one record.
   * The episode count is also what separates two same-year series. Both halves
   * are guarded: releaseYear is 0 until the admin fills it in, and a series with
   * no published episodes must not advertise "0 episodes".
   */
  const meta: string[] = [];
  if (series.releaseYear > 0) meta.push(String(series.releaseYear));
  if (episodesLabel) meta.push(episodesLabel);

  return (
    <SuggestionRow
      title={series.title}
      term={term}
      imageUrl={series.posterUrl ?? series.coverUrl}
      // The tab's own glyph, and the series empty state's — one icon per kind.
      fallbackIcon="tv-outline"
      thumbWidth={POSTER_THUMB_WIDTH}
      meta={meta.length > 0 ? meta.join(" · ") : null}
      onPress={() => onSelect(series)}
    />
  );
}

import { memo, useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ListCard } from "@/components/search/ListCard";
import { useLanguage } from "@/localization/LanguageProvider";
import type { SeriesListItem } from "@/types/series";

interface Props {
  series: SeriesListItem;
  /** Both the card body and the "View" pill — there is nothing to play from a list row. */
  onPress: (series: SeriesListItem) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A series as a results row — the movie card's shape with the series facts:
 * "year · language · genre", the blurb, the star when rated, and a quiet
 * "View" pill instead of "Watch Now" (an episode has to be picked first).
 * No bookmark: the watchlist is movie ids only, and offering a control that
 * cannot work would be worse than none.
 */
export const SeriesListCard = memo(function SeriesListCard({ series, onPress, style }: Props) {
  const { t } = useLanguage();

  const meta = useMemo(
    () =>
      [series.releaseYear > 0 ? String(series.releaseYear) : null, series.language || null, series.genre || null]
        .filter((part): part is string => part !== null)
        .join(" · "),
    [series.releaseYear, series.language, series.genre],
  );
  const chips = useMemo(() => series.categories.map((category) => category.name), [series.categories]);
  const action = useMemo(
    () => ({ label: t.search.view, icon: "chevron-forward" as const, onPress: () => onPress(series) }),
    [t, onPress, series],
  );

  return (
    <ListCard
      title={series.title}
      posterUrl={series.posterUrl}
      coverUrl={series.coverUrl}
      accessType={series.accessType}
      meta={meta}
      chips={chips}
      description={series.description ?? ""}
      rating={series.rating}
      action={action}
      onPress={() => onPress(series)}
      style={style}
    />
  );
});

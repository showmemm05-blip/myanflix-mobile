import { useCallback } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MediaCard, useRailCardWidth } from "@/components/common/MediaCard";
import { seriesCardContent } from "@/components/movie/mediaItems";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SeriesListItem } from "@/types/series";

interface Props {
  title: string;
  series: SeriesListItem[];
  onPressSeries: (series: SeriesListItem) => void;
  onSeeAll?: () => void;
}

const ITEM_GAP = 12;

// Module scope, same shape as MediaRail: an inline separator ARROW is a new
// component TYPE every render, so React unmounts and rebuilds every separator
// view in the rail rather than updating them.
const keyExtractor = (item: SeriesListItem) => item.id;
const Separator = () => <View style={styles.separator} />;

/** Horizontal series rail built from the app's portrait MediaCard — mirrors MediaRail's numbers. */
export function SeriesRow({ title, series, onPressSeries, onSeeAll }: Props) {
  const { t } = useLanguage();
  const cardWidth = useRailCardWidth();

  const renderItem = useCallback(
    ({ item }: { item: SeriesListItem }) => (
      <MediaCard
        {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
        width={cardWidth}
        onPress={() => onPressSeries(item)}
      />
    ),
    [t, cardWidth, onPressSeries],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<SeriesListItem> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: theme.layout.screenPadding + (cardWidth + ITEM_GAP) * index,
      index,
    }),
    [cardWidth],
  );

  if (series.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} onSeeAll={onSeeAll} seeAllLabel={t.common.seeAll} />
      <FlatList
        horizontal
        data={series}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        snapToInterval={cardWidth + ITEM_GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        renderItem={renderItem}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  listContent: { paddingHorizontal: theme.layout.screenPadding },
  separator: { width: ITEM_GAP },
});

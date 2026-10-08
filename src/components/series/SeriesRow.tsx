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
  /** Fixed card width — the title pages pass the boards' 112pt (see MediaRail). */
  cardWidth?: number;
}

/** Marquee rails: 10pt between cards, the same stride as MediaRail. */
const ITEM_GAP = 10;

// Module scope, same shape as MediaRail: an inline separator ARROW is a new
// component TYPE every render, so React unmounts and rebuilds every separator
// view in the rail rather than updating them.
const keyExtractor = (item: SeriesListItem) => item.id;
const Separator = () => <View style={styles.separator} />;

/** Horizontal series rail built from the app's portrait MediaCard — mirrors MediaRail's numbers. */
export function SeriesRow({ title, series, onPressSeries, onSeeAll, cardWidth: fixedWidth }: Props) {
  const { t } = useLanguage();
  const railWidth = useRailCardWidth();
  const cardWidth = fixedWidth ?? railWidth;

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
  /** SectionHeader already keeps the board's 14pt above the cards. */
  container: {},
  listContent: { paddingHorizontal: theme.layout.screenPadding },
  separator: { width: ITEM_GAP },
});

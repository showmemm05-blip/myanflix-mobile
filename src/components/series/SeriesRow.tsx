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

/** Horizontal series rail built from the app's portrait MediaCard — mirrors MediaRail's numbers. */
export function SeriesRow({ title, series, onPressSeries, onSeeAll }: Props) {
  const { t } = useLanguage();
  const cardWidth = useRailCardWidth();

  if (series.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader title={title} onSeeAll={onSeeAll} seeAllLabel={t.common.seeAll} />
      <FlatList
        horizontal
        data={series}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ width: ITEM_GAP }} />}
        snapToInterval={cardWidth + ITEM_GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        renderItem={({ item }) => (
          <MediaCard
            {...seriesCardContent(item, t.series.episodeCount.replace("{n}", String(item.episodeCount)))}
            width={cardWidth}
            onPress={() => onPressSeries(item)}
          />
        )}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: theme.layout.screenPadding + (cardWidth + ITEM_GAP) * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  listContent: { paddingHorizontal: theme.layout.screenPadding },
});

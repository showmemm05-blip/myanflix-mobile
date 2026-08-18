import { FlatList, View, StyleSheet } from "react-native";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MediaCard, useRailCardWidth } from "@/components/common/MediaCard";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { SeriesListItem } from "@/types/series";

interface Props {
  title: string;
  series: SeriesListItem[];
  onPressSeries: (series: SeriesListItem) => void;
  onSeeAll?: () => void;
}

const ITEM_GAP = theme.spacing.md;

/** Horizontal series rail built from the app's signature MediaCard. */
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
        renderItem={({ item }) => (
          <MediaCard
            title={item.title}
            imageUrl={item.coverUrl ?? item.posterUrl}
            posterUrl={item.posterUrl}
            accessType={item.accessType}
            meta={[item.releaseYear, t.series.episodeCount.replace("{n}", String(item.episodeCount)), item.genre]}
            width={cardWidth}
            onPress={() => onPressSeries(item)}
          />
        )}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: (cardWidth + ITEM_GAP) * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  listContent: { paddingHorizontal: theme.layout.screenPadding },
});

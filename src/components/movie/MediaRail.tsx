import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MediaCard, MediaCardSkeleton, useRailCardWidth, type MediaCardProps } from "@/components/common/MediaCard";
import { theme } from "@/theme";

const GAP = theme.spacing.md;
/** The rail's leading content inset — item 0 starts this far in. */
const EDGE = theme.layout.screenPadding;
const SKELETON_COUNT = 2;

export interface MediaRailItem
  extends Pick<
    MediaCardProps,
    "title" | "imageUrl" | "posterUrl" | "accessType" | "rating" | "meta" | "progress" | "cornerLabel" | "showPoster"
  > {
  /** Stable list key — the record id. */
  key: string;
  onPress?: () => void;
}

interface Props {
  title: string;
  items: MediaRailItem[];
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Leading accent icon in the section header. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Header accent colour — violet by default, gold/emerald for role rails. */
  accent?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** Renders placeholder cards instead of hiding the rail while data loads. */
  loading?: boolean;
}

const keyExtractor = (item: MediaRailItem) => item.key;
const Separator = () => <View style={styles.separator} />;

/**
 * One rail cell. Memoized so a parent re-render only reaches the cards whose
 * item object actually changed — callers hand `items` in already memoized, so
 * an unrelated state change on the screen re-renders nothing here.
 */
const RailCard = memo(function RailCard({ item, width }: { item: MediaRailItem; width: number }) {
  return (
    <MediaCard
      width={width}
      title={item.title}
      imageUrl={item.imageUrl}
      posterUrl={item.posterUrl}
      accessType={item.accessType}
      rating={item.rating}
      meta={item.meta}
      progress={item.progress}
      cornerLabel={item.cornerLabel}
      showPoster={item.showPoster}
      onPress={item.onPress}
    />
  );
});

/**
 * A horizontally scrolling shelf of MediaCards — the one rail used by Home,
 * Search and the detail screens. Cards sit at ~78% of the screen so the 16:9
 * still stays readable and the next card peeks in to invite the swipe.
 */
export function MediaRail({ title, items, eyebrow, icon, accent, onSeeAll, seeAllLabel, loading }: Props) {
  const cardWidth = useRailCardWidth();

  const renderItem = useCallback<ListRenderItem<MediaRailItem>>(
    ({ item }) => <RailCard item={item} width={cardWidth} />,
    [cardWidth],
  );

  /**
   * Cells are laid out on a `cardWidth + GAP` stride (the separator sits
   * between them) and the whole row is inset by the content padding, so the
   * frame of item n starts at EDGE + stride * n and is exactly cardWidth long.
   */
  const getItemLayout = useCallback(
    (_: ArrayLike<MediaRailItem> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: EDGE + (cardWidth + GAP) * index,
      index,
    }),
    [cardWidth],
  );

  if (!loading && items.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader
        title={title}
        eyebrow={eyebrow}
        icon={icon}
        accent={accent}
        onSeeAll={onSeeAll}
        seeAllLabel={seeAllLabel}
      />

      {loading && items.length === 0 ? (
        <View style={styles.skeletonRow}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <MediaCardSkeleton key={index} width={cardWidth} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={keyExtractor}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
          snapToInterval={cardWidth + GAP}
          decelerationRate="fast"
          snapToAlignment="start"
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.xs },
  listContent: { paddingHorizontal: EDGE, paddingBottom: theme.spacing.xs },
  skeletonRow: { flexDirection: "row", gap: GAP, paddingHorizontal: EDGE },
  separator: { width: GAP },
});

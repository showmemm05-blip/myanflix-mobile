import { memo, useCallback, useMemo, type ReactElement } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MediaCard, MediaCardSkeleton, useRailCardWidth, type MediaCardProps } from "@/components/common/MediaCard";
import { theme } from "@/theme";

/** Marquee rails: 10pt between cards. */
const GAP = 10;
/** The rail's leading content inset — item 0 starts this far in. */
const EDGE = theme.layout.screenPadding;
const SKELETON_COUNT = 4;

export interface MediaRailItem
  extends Pick<
    MediaCardProps,
    "title" | "posterUrl" | "coverUrl" | "accessType" | "rating" | "meta" | "progress" | "cornerLabel" | "isNew"
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
  /** One quiet line under the title. */
  subtitle?: string;
  /**
   * Fixed card width. Defaults to the shared rail width (useRailCardWidth);
   * the title pages pass the boards' 112pt so three posters and a peek show.
   */
  cardWidth?: number;
  /** A cell after the last card — Browse's "See all" tile. Pass a stable element. */
  endTile?: ReactElement | null;
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
      posterUrl={item.posterUrl}
      coverUrl={item.coverUrl}
      accessType={item.accessType}
      rating={item.rating}
      meta={item.meta}
      progress={item.progress}
      cornerLabel={item.cornerLabel}
      isNew={item.isNew}
      onPress={item.onPress}
    />
  );
});

/**
 * A horizontally scrolling shelf of portrait MediaCards — the one rail used by
 * Home, Search and the detail screens. Cards sit at ~36% of the screen so two
 * and a bit posters show at once and the next card peeks in to invite the swipe.
 */
export function MediaRail({
  title,
  items,
  eyebrow,
  icon,
  accent,
  onSeeAll,
  seeAllLabel,
  loading,
  subtitle,
  cardWidth: fixedWidth,
  endTile,
}: Props) {
  const railWidth = useRailCardWidth();
  const cardWidth = fixedWidth ?? railWidth;

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

  // FlatList compares the footer by identity — rebuilt only when the tile changes.
  const footer = useMemo(() => (endTile ? <View style={styles.endTile}>{endTile}</View> : null), [endTile]);

  if (!loading && items.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* An empty title drops the heading — a rail under its own banner (Browse). */}
      {title ? (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          icon={icon}
          accent={accent}
          onSeeAll={onSeeAll}
          seeAllLabel={seeAllLabel}
        />
      ) : null}

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
          initialNumToRender={4}
          maxToRenderPerBatch={6}
          windowSize={5}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          ListFooterComponent={footer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** SectionHeader already keeps the board's 14pt above the cards. */
  container: {},
  listContent: { paddingHorizontal: EDGE, paddingBottom: theme.spacing.xs },
  endTile: { marginLeft: GAP },
  skeletonRow: { flexDirection: "row", gap: GAP, paddingHorizontal: EDGE, overflow: "hidden" },
  separator: { width: GAP },
});

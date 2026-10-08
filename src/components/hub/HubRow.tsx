import { memo, useCallback, type ReactNode } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Text as SvgText } from "react-native-svg";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { MediaCard, MediaCardSkeleton } from "@/components/common/MediaCard";
import { Skeleton } from "@/components/common/Skeleton";
import { LandscapeCard, LandscapeCardSkeleton } from "@/components/movie/LandscapeRail";
import { BookCard, BookCardSkeleton } from "@/components/books/BookCard";
import { HubFallbackArt } from "@/components/hub/HubFallbackArt";
import { joinMeta } from "@/components/hub/hubLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/**
 * - "poster" — 112pt 2:3 MediaCards: title + one meta line under the art (Top rated, Free, a category).
 * - "ranked" — the Movies hub's Popular shelf (the board's "Top 10"): a big outlined numeral tucked behind each 112pt poster.
 * - "landscape" — 248pt 16:9 LandscapeCards with the NEW tab (Recently added, New series).
 * - "cover" — 116pt 5:7 BookCards: the byline in bold, the meta in the quiet ink (book shelves).
 */
export type HubRowVariant = "poster" | "ranked" | "landscape" | "cover";

/** One card on a hub row — the same shape for every variant (and LandscapeItem-compatible). */
export interface HubRowItem {
  /** Stable list key — the record id. */
  key: string;
  title: string;
  /**
   * The art for THIS variant: posterUrl ?? coverUrl for poster/ranked,
   * coverUrl ?? posterUrl for landscape, the book cover for cover.
   */
  imageUrl: string | null;
  /** SUBSCRIPTION stamps the gold crown on the art. */
  accessType?: AccessType | null;
  /** The crimson NEW tab (from createdAt — never a guess). */
  isNew?: boolean;
  /** > 0 adds "★ x.x" to the meta line (poster, landscape). */
  rating?: number | null;
  /** The quiet line under the title: parts joined with " · " (empty parts dropped). */
  meta?: Array<string | number | null | undefined>;
  /** Cover variant only: the bold line under the cover (the author). */
  byline?: string | null;
  /** Landscape variant only: 0–100, the crimson progress line on the art (Home's Continue watching). */
  progress?: number | null;
  /** Landscape variant only: the spoken name of the card, when the title and tags are not enough. */
  accessibilityLabel?: string;
  onPress: () => void;
}

interface Props {
  title: string;
  /** One quiet line under the heading ("No subscription needed"). */
  subtitle?: string;
  items: HubRowItem[];
  variant?: HubRowVariant;
  /** Placeholder cards (same geometry) instead of hiding the row while its query loads. */
  loading?: boolean;
  onSeeAll?: () => void;
  /** Defaults to the localized "See all". */
  seeAllLabel?: string;
  /** Replaces the heading with the caller's own block (the Books board's category banner). */
  header?: ReactNode;
  /** On the row's own box — e.g. the gap above it in a list of rows, which goes away with an empty row. */
  style?: StyleProp<ViewStyle>;
}

/** Boards: rail posters 112 × 168, book covers 116, landscape cards 248 × 140. */
const POSTER_WIDTH = 112;
const POSTER_HEIGHT = 168;
const LANDSCAPE_WIDTH = 248;
const COVER_WIDTH = 116;
const GAP: Record<HubRowVariant, number> = { poster: 10, ranked: 4, landscape: 10, cover: 12 };
const EDGE = theme.layout.screenPadding;
const SKELETON_COUNT: Record<HubRowVariant, number> = { poster: 4, ranked: 3, landscape: 2, cover: 4 };

/**
 * The ranked cell: the numeral's own column plus the poster. The numeral
 * runs `RANK_TUCK` under the poster's left edge, as the board tucks it.
 *
 * Wider than the board's fixed 152pt cell (a 40pt column) on purpose: there
 * the poster hides most of a 140pt digit and ALL of the "0" in "10", which
 * then reads as "1". Here a digit shows about two thirds of itself and "10"
 * keeps both figures. Measured on the bundled NotoSansMyanmar_900Black: a
 * digit advances 0.586em (75pt at 128pt), so "10" with its -8 tracking is
 * 142pt — the full SVG width.
 */
const RANK_SPACE_ONE = 52;
const RANK_SPACE_TWO = 116;
const RANK_TUCK = 26;
const RANK_SIZE = 128;
/**
 * The numeral starts here and runs right, under the poster — so a font with
 * wider figures (a fallback) slides further under the poster instead of being
 * cut off on the left. With the bundled font the digit's own side bearing
 * (~5pt) is the rest of the inset.
 */
const RANK_INSET = 2;

/**
 * A hub's rail: the section heading (white "See all", as the hub boards
 * draw it) over a horizontally scrolling row of cards. Renders nothing once
 * loaded empty, and placeholder cards of the same size while loading, so the
 * page never jumps when a row lands. A card with no art gets its drawn
 * HubFallbackArt (a book: BookCover's own no-image cover), never a blank box.
 */
export function HubRow({
  title,
  subtitle,
  items,
  variant = "poster",
  loading = false,
  onSeeAll,
  seeAllLabel,
  header,
  style,
}: Props) {
  const { t } = useLanguage();
  const gap = GAP[variant];

  const renderItem = useCallback<ListRenderItem<HubRowItem>>(
    ({ item, index }) => <HubRowCell item={item} variant={variant} rank={index + 1} />,
    [variant],
  );
  const Separator = useCallback(() => <View style={{ width: gap }} />, [gap]);

  if (!loading && items.length === 0) return null;

  return (
    <View style={style}>
      {header ?? (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          titleLines={3}
          onSeeAll={onSeeAll}
          seeAllLabel={seeAllLabel ?? t.common.seeAll}
          seeAllTone="text"
        />
      )}
      {loading && items.length === 0 ? (
        <View
          style={[styles.skeletonRow, { gap }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t.common.loading}
        >
          {Array.from({ length: SKELETON_COUNT[variant] }, (_, i) => (
            <RowSkeleton key={i} variant={variant} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          decelerationRate="fast"
          initialNumToRender={4}
          maxToRenderPerBatch={6}
          windowSize={5}
        />
      )}
    </View>
  );
}

const keyExtractor = (item: HubRowItem) => item.key;

const HubRowCell = memo(function HubRowCell({
  item,
  variant,
  rank,
}: {
  item: HubRowItem;
  variant: HubRowVariant;
  rank: number;
}) {
  switch (variant) {
    case "ranked":
      return <RankedCell item={item} rank={rank} />;
    case "landscape":
      return (
        <LandscapeCard
          item={item}
          width={LANDSCAPE_WIDTH}
          fallbackArt={<HubFallbackArt seed={item.key} format="landscape" />}
        />
      );
    case "cover":
      return <CoverCell item={item} />;
    case "poster":
    default:
      return (
        <MediaCard
          width={POSTER_WIDTH}
          title={item.title}
          posterUrl={item.imageUrl}
          accessType={item.accessType}
          rating={item.rating && item.rating > 0 ? item.rating : null}
          meta={item.meta}
          isNew={item.isNew}
          fallbackArt={<HubFallbackArt seed={item.key} format="poster" />}
          onPress={item.onPress}
        />
      );
  }
});

/**
 * The Top 10 cell (Main.dc.html "Top 10 movies"): an outlined numeral — the
 * ground colour with a 2pt #5E5E6A stroke, weight 900 — tucked behind the
 * poster's left edge. RN text has no stroke, so the numeral is one SVG glyph,
 * as Search's trending rows draw theirs; it is decoration (the cell's label
 * speaks the rank) at a fixed size, never scaled with the OS text size.
 */
function RankedCell({ item, rank }: { item: HubRowItem; rank: number }) {
  const { t } = useLanguage();
  const isPremium = item.accessType === "SUBSCRIPTION";
  const space = rank >= 10 ? RANK_SPACE_TWO : RANK_SPACE_ONE;
  const svgWidth = space + RANK_TUCK;
  const label = [
    t.search.rankA11y.replace("{n}", String(rank)),
    item.title,
    joinMeta(item.meta ?? []) || null,
    isPremium ? t.movie.premium : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <PressableScale onPress={item.onPress} dimOnPress accessibilityLabel={label} style={{ width: space + POSTER_WIDTH, height: POSTER_HEIGHT }}>
      <Svg width={svgWidth} height={POSTER_HEIGHT} style={styles.rank} accessible={false} pointerEvents="none">
        <SvgText
          x={RANK_INSET}
          y={POSTER_HEIGHT - 2}
          textAnchor="start"
          fontSize={RANK_SIZE}
          fontWeight="900"
          fontFamily={theme.font.black}
          letterSpacing={-8}
          fill={theme.colors.background}
          stroke={theme.colors.textDecor}
          strokeWidth={2}
        >
          {String(rank)}
        </SvgText>
      </Svg>
      <View style={styles.rankPoster}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            accessible={false}
          />
        ) : (
          <HubFallbackArt seed={item.key} format="poster" />
        )}
        {isPremium && (
          <View style={styles.crown} pointerEvents="none">
            <CrownGlyph size={12} color={theme.colors.premium} />
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/** A shelf book: the shared BookCard, with the NEW tab hung on the cover when the data says so. */
function CoverCell({ item }: { item: HubRowItem }) {
  const { t } = useLanguage();
  return (
    <View style={{ width: COVER_WIDTH }}>
      <BookCard
        title={item.title}
        author={item.byline ?? ""}
        showAuthor={!!item.byline}
        category={joinMeta(item.meta ?? []) || null}
        coverUrl={item.imageUrl}
        width={COVER_WIDTH}
        onPress={item.onPress}
      />
      {item.isNew ? (
        <View style={styles.newTab} pointerEvents="none">
          <ThemedText variant="overline" color={theme.colors.onPrimary} style={styles.newTabText}>
            {t.movie.newBadge.toUpperCase()}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function RowSkeleton({ variant }: { variant: HubRowVariant }) {
  switch (variant) {
    case "landscape":
      return <LandscapeCardSkeleton width={LANDSCAPE_WIDTH} />;
    case "cover":
      return <BookCardSkeleton width={COVER_WIDTH} />;
    case "ranked":
      return (
        <View style={{ width: RANK_SPACE_ONE + POSTER_WIDTH, height: POSTER_HEIGHT, alignItems: "flex-end" }}>
          <Skeleton width={POSTER_WIDTH} height={POSTER_HEIGHT} radius="card" />
        </View>
      );
    case "poster":
    default:
      return <MediaCardSkeleton width={POSTER_WIDTH} />;
  }
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: EDGE, paddingBottom: theme.spacing.xs },
  skeletonRow: { flexDirection: "row", paddingHorizontal: EDGE, overflow: "hidden" },
  rank: { position: "absolute", left: 0, top: 0 },
  rankPoster: {
    position: "absolute",
    right: 0,
    top: 0,
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.card,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  crown: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: theme.colors.artBadge,
    alignItems: "center",
    justifyContent: "center",
  },
  newTab: {
    position: "absolute",
    left: 0,
    top: 10,
    minHeight: 20,
    paddingHorizontal: 7,
    justifyContent: "center",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  newTabText: { fontSize: 10 },
});

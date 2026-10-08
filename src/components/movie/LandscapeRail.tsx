import { memo, useCallback, useMemo, type ReactElement, type ReactNode } from "react";
import { FlatList, StyleSheet, View, type ListRenderItem } from "react-native";
import { Image } from "expo-image";
// Deep imports, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { PulseDots } from "@/components/detail/PulseDots";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AccessType } from "@/types/movie";

/** The boards' 16:9 landscape card: 240 × 135, radius 12. */
export const LANDSCAPE_CARD_WIDTH = 240;
export const LANDSCAPE_CARD_HEIGHT = 135;
const GAP = 10;

export interface LandscapeItem {
  /** Stable list key — the record id. */
  key: string;
  title: string;
  /** Landscape art first: coverUrl ?? posterUrl. */
  imageUrl: string | null;
  accessType?: AccessType | null;
  isNew?: boolean;
  /** Non-null draws "★ x.x" at the head of the meta line. */
  rating?: number | null;
  meta?: Array<string | number | null | undefined>;
  /**
   * 0–100: the crimson progress line along the foot of the art (Home's
   * Continue watching — HomeMovies.dc.html). Omitted or null: no line.
   */
  progress?: number | null;
  /** Spoken name of the whole card; defaults to the title plus its tags ("Resume …, 62% watched, 47m left"). */
  accessibilityLabel?: string;
  onPress: () => void;
}

/**
 * The 16:9 card of the boards' "Recommended", "Recently added" and a person's
 * Series rail: the art with the gold crown and NEW tab stamped on it, then the
 * title and one quiet meta line under it — the same title-below rule as the
 * portrait MediaCard, so real artwork is never fought by overlaid text.
 */
export const LandscapeCard = memo(function LandscapeCard({
  item,
  width = LANDSCAPE_CARD_WIDTH,
  fallbackArt,
}: {
  item: LandscapeItem;
  width?: number;
  /** Drawn in place of the film glyph when there is no art (the hubs' HubFallbackArt). */
  fallbackArt?: ReactNode;
}) {
  const { t } = useLanguage();
  const isPremium = item.accessType === "SUBSCRIPTION";
  const metaText = (item.meta ?? []).filter((part) => part !== null && part !== undefined && `${part}`.length > 0).join(" · ");
  const rating = item.rating ?? null;
  const height = Math.round((width * LANDSCAPE_CARD_HEIGHT) / LANDSCAPE_CARD_WIDTH);
  const progress = item.progress === null || item.progress === undefined ? null : Math.min(100, Math.max(0, item.progress));

  return (
    <PressableScale
      onPress={item.onPress}
      dimOnPress
      accessibilityLabel={
        item.accessibilityLabel ??
        [item.title, isPremium ? t.movie.premium : null, item.isNew ? t.movie.newBadge : null].filter(Boolean).join(", ")
      }
      style={{ width }}
    >
      <View style={[styles.art, { height }]}>
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
          (fallbackArt ?? (
            <View style={styles.fallback}>
              <Ionicons name="film-outline" size={26} color={theme.colors.textFaint} />
            </View>
          ))
        )}
        {isPremium && (
          <View style={styles.crown} pointerEvents="none">
            <CrownGlyph size={12} color={theme.colors.premium} />
          </View>
        )}
        {item.isNew ? (
          <View style={[styles.newTab, isPremium && styles.newTabBelowCrown]} pointerEvents="none">
            <ThemedText variant="overline" color={theme.colors.onPrimary} style={styles.newTabText}>
              {t.movie.newBadge.toUpperCase()}
            </ThemedText>
          </View>
        ) : null}
        {progress !== null ? (
          // The board's 3pt track and crimson fill, 8pt in from the sides, 6pt
          // off the foot. Decoration: the percent is spoken in the card's label.
          <View style={styles.progressTrack} pointerEvents="none">
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        ) : null}
      </View>

      <ThemedText variant="caption" weight="bold" color={theme.colors.text} numberOfLines={1} style={styles.title}>
        {item.title}
      </ThemedText>
      {(rating !== null || metaText.length > 0) && (
        <View style={styles.metaRow}>
          {rating !== null && <Ionicons name="star" size={12} color={theme.colors.premium} />}
          <ThemedText variant="caption" weight="regular" tabular color={theme.colors.textMuted} numberOfLines={1} style={styles.meta}>
            {[rating !== null ? rating.toFixed(1) : null, metaText.length > 0 ? metaText : null].filter(Boolean).join(" · ")}
          </ThemedText>
        </View>
      )}
    </PressableScale>
  );
});

/** Placeholder with the card's exact geometry. */
export function LandscapeCardSkeleton({ width = LANDSCAPE_CARD_WIDTH }: { width?: number }) {
  return (
    <View style={{ width }}>
      <Skeleton width={width} height={Math.round((width * LANDSCAPE_CARD_HEIGHT) / LANDSCAPE_CARD_WIDTH)} radius="lg" />
      <Skeleton width="60%" height={12} radius="sm" style={styles.skeletonLine} />
    </View>
  );
}

/* ------------------------------------------------------------------ */

interface RailProps {
  title: string;
  subtitle?: string;
  /** Right-hand accessory in the heading ("Newest first"). */
  accessory?: ReactElement;
  items: LandscapeItem[];
  /** A cell after the last card ("Show more"). Pass a stable element. */
  endTile?: ReactElement | null;
}

const keyExtractor = (item: LandscapeItem) => item.key;
const Separator = () => <View style={styles.separator} />;

/** A heading over a horizontally scrolling row of LandscapeCards. Renders nothing when empty. */
export function LandscapeRail({ title, subtitle, accessory, items, endTile }: RailProps) {
  const renderItem = useCallback<ListRenderItem<LandscapeItem>>(({ item }) => <LandscapeCard item={item} />, []);
  const getItemLayout = useCallback(
    (_: ArrayLike<LandscapeItem> | null | undefined, index: number) => ({
      length: LANDSCAPE_CARD_WIDTH,
      offset: theme.layout.screenPadding + (LANDSCAPE_CARD_WIDTH + GAP) * index,
      index,
    }),
    [],
  );
  const footer = useMemo(() => (endTile ? <View style={styles.endTile}>{endTile}</View> : null), [endTile]);

  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader title={title} subtitle={subtitle} accessory={accessory} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={Separator}
        ListFooterComponent={footer}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={LANDSCAPE_CARD_WIDTH + GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        initialNumToRender={3}
        windowSize={5}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The quiet tile at the end of a rail — "See all" (Browse) or "Show more" (a
 * person's series). `busy` swaps the glyph for pulsing dots and holds the
 * press while the next page is on the wire.
 */
export function RailEndTile({
  label,
  icon,
  onPress,
  width,
  height,
  busy = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  width: number;
  height: number;
  busy?: boolean;
}) {
  return (
    <PressableScale
      onPress={busy ? undefined : onPress}
      disabled={busy}
      accessibilityLabel={label}
      style={[styles.endTileBox, { width, minHeight: height }]}
    >
      <View style={styles.endTileDisc}>
        {busy ? <PulseDots size={6} /> : <Ionicons name={icon} size={20} color={theme.colors.text} />}
      </View>
      <ThemedText variant="muted" weight="bold" color={theme.colors.text} style={styles.endTileLabel}>
        {label}
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  art: {
    width: "100%",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.skeleton,
  },
  fallback: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  crown: {
    position: "absolute",
    top: 8,
    left: 8,
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
  newTabBelowCrown: { top: 36 },
  newTabText: { fontSize: 10 },
  progressTrack: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 6,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: theme.colors.track,
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: theme.colors.primary },
  title: { marginTop: theme.spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { flexShrink: 1 },
  skeletonLine: { marginTop: 10 },
  list: { paddingHorizontal: theme.layout.screenPadding },
  separator: { width: GAP },
  endTile: { marginLeft: GAP },
  endTileBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  endTileDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonal,
  },
  endTileLabel: { textAlign: "center" },
});

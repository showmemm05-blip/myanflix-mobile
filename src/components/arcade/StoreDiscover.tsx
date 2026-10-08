import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeArt } from "@/components/arcade/ArcadeArt";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { ArcadePrice, priceLabel } from "@/components/arcade/ArcadePrice";
import { ArcadeSection } from "@/components/arcade/ArcadeSection";
import { ANNOUNCED_LANES, discoverGames, type Lane } from "@/data/arcade";
import type { Game } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

/** Main.dc.html: 128×192 posters on a 10pt gap. */
const CARD_WIDTH = 128;
const POSTER_HEIGHT = 192;
const GAP = 10;

/**
 * The title set in the art is a logotype in a fixed 108pt column (128 minus
 * the 10pt insets). The widest title word, EMBERFALL, is ~79pt at 14pt black,
 * so above ~1.35× text it no longer fits one line and would break mid-word.
 * The spoken label carries the title at any text size.
 */
const POSTER_TITLE_MAX_SCALE = 1.3;

type DiscoverItem = { kind: "game"; game: Game } | { kind: "lane"; lane: Lane };

const ITEMS: DiscoverItem[] = [
  ...discoverGames.map((game): DiscoverItem => ({ kind: "game", game })),
  ...ANNOUNCED_LANES.map((lane): DiscoverItem => ({ kind: "lane", lane })),
];

const keyExtractor = (item: DiscoverItem) =>
  item.kind === "game" ? item.game.id : `lane-${item.lane.id}`;

/**
 * The whole shelf, newest first, as a snapping rail of posters — followed by
 * one non-pressable "Soon" teaser per announced lane (anime, podcast, live).
 */
export function StoreDiscover({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();
  const gutter = layout.gutter;

  /** Fixed 128pt cells on a 10pt gap, inset by the gutter — exact offsets. */
  const getItemLayout = useCallback(
    (_: ArrayLike<DiscoverItem> | null | undefined, index: number) => ({
      length: CARD_WIDTH,
      offset: gutter + (CARD_WIDTH + GAP) * index,
      index,
    }),
    [gutter],
  );

  const renderItem = useCallback(
    ({ item }: { item: DiscoverItem }) => {
      if (item.kind === "lane") {
        const { lane } = item;
        return (
          <View
            style={[styles.card, styles.teaser]}
            accessible
            accessibilityLabel={`${t.arcade.lanes[lane.id]}, ${t.arcade.state.soon}`}
          >
            <Ionicons name={lane.icon} size={26} color={theme.colors.textDecor} />
            <ThemedText variant="muted" weight="bold" color={theme.colors.textMuted} style={styles.center}>
              {t.arcade.lanes[lane.id]}
            </ThemedText>
            <View style={styles.soonChip}>
              <ThemedText variant="label" weight="bold" color={theme.colors.textMuted} style={styles.chipLabel}>
                {t.arcade.state.soon}
              </ThemedText>
            </View>
          </View>
        );
      }

      const { game } = item;
      const price = priceLabel(game, t.arcade.price.free);
      const label = [
        game.title,
        game.genre,
        String(game.releaseYear),
        game.badge ? t.arcade.badge[game.badge] : null,
        price,
      ]
        .filter(Boolean)
        .join(", ");

      return (
        <PressableScale onPress={onPressGame} accessibilityLabel={label} style={styles.card}>
          <View style={styles.poster}>
            <ArcadeArt gameId={game.id} format="poster" band />
            <ThemedText weight="black" maxFontSizeMultiplier={POSTER_TITLE_MAX_SCALE} style={styles.posterTitle}>
              {game.title}
            </ThemedText>
            {game.badge === "new" ? (
              <View style={styles.newTab}>
                <ThemedText variant="overline" color={theme.colors.onPrimary} style={styles.chipLabel}>
                  {t.arcade.badge.new}
                </ThemedText>
              </View>
            ) : game.badge ? (
              <ArcadeBadge kind={game.badge} style={styles.badge} />
            ) : null}
          </View>
          <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.meta}>
            {`${game.genre} · `}
            <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} tabular>
              {String(game.releaseYear)}
            </ThemedText>
          </ThemedText>
          <ArcadePrice game={game} size="sm" />
        </PressableScale>
      );
    },
    [t, onPressGame],
  );

  return (
    <ArcadeSection eyebrow={t.arcade.discover.kicker} title={t.arcade.discover.title} gutter={gutter}>
      <FlatList
        data={ITEMS}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Snap so a poster always comes to rest on the page gutter.
        snapToInterval={CARD_WIDTH + GAP}
        decelerationRate="fast"
        contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}
        // This rail sits below the fold inside Home's ScrollView, so without
        // batching all 15 SVG scenes mount at first paint. The exact offsets
        // above mean the rest arrive on a flick with no measurement pass.
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
      />
    </ArcadeSection>
  );
}

const styles = StyleSheet.create({
  rail: { gap: GAP, alignItems: "flex-start" },
  card: { width: CARD_WIDTH },
  poster: {
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.card,
    overflow: "hidden",
  },
  /** 14/15 black capitals in the art's dark band — titles stay Latin in both languages. */
  posterTitle: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 12,
    fontSize: 14,
    lineHeight: 15,
    letterSpacing: -0.28,
    textTransform: "uppercase",
    color: theme.colors.text,
  },
  /** The crimson NEW tab, flush to the poster's left edge. */
  newTab: {
    position: "absolute",
    top: 10,
    left: 0,
    minHeight: 20,
    justifyContent: "center",
    paddingHorizontal: 7,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  badge: { position: "absolute", top: 8, left: 8 },
  meta: { marginTop: 10 },
  /** Translated chip words: no tracking. */
  chipLabel: { letterSpacing: 0 },
  teaser: {
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  center: { textAlign: "center" },
  soonChip: {
    minHeight: 24,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceElevated,
  },
});

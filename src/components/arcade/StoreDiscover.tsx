import { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GamePlate } from "@/components/common/GamePlate";
import { Pill } from "@/components/ui/Pill";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { FreeTag } from "@/components/arcade/FreeTag";
import { SectionRule } from "@/components/arcade/SectionRule";
import { SlugText } from "@/components/arcade/SlugText";
import { ANNOUNCED_LANES, discoverGames, isFreeGame, type Lane } from "@/data/arcade";
import { PLATE_PALETTES, formatKyat, type Game, type PlatePalette } from "@/data/games";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

const CARD_WIDTH = 180;
const GAP = 12;

/** Desaturated navy plate for the announced-lane teasers — no game identity. */
const TEASER_PALETTE: PlatePalette = { hueA: "#3a3f55", hueB: "#242838" };

type DiscoverItem = { kind: "game"; game: Game } | { kind: "lane"; lane: Lane };

const ITEMS: DiscoverItem[] = [
  ...discoverGames.map((game): DiscoverItem => ({ kind: "game", game })),
  ...ANNOUNCED_LANES.map((lane): DiscoverItem => ({ kind: "lane", lane })),
];

/**
 * The whole shelf, newest first, as a snapping horizontal rail — followed by
 * one non-pressable teaser tile per announced lane (anime, podcast, live).
 */
export function StoreDiscover({ onPressGame }: Props) {
  const { t } = useLanguage();

  const renderItem = useCallback(
    ({ item }: { item: DiscoverItem }) => {
      if (item.kind === "lane") {
        const { lane } = item;
        return (
          <View style={styles.card}>
            <GamePlate palette={TEASER_PALETTE} radius="lg" scrim={false} dimmed style={styles.plate}>
              <View style={styles.teaserContent}>
                <Ionicons name={lane.icon} size={22} color={theme.colors.textFaint} />
                <ThemedText variant="caption" color={theme.colors.textMuted}>
                  {t.arcade.lanes[lane.id]}
                </ThemedText>
                <Pill tone="neutral">{t.arcade.state.soon}</Pill>
              </View>
            </GamePlate>
          </View>
        );
      }

      const { game } = item;
      return (
        <PressableScale onPress={onPressGame} accessibilityLabel={game.title} style={styles.card}>
          <GamePlate palette={PLATE_PALETTES[game.id]} radius="lg" style={styles.plate}>
            {game.badge && <ArcadeBadge kind={game.badge} style={styles.badge} />}
          </GamePlate>
          <ThemedText variant="caption" weight="medium" numberOfLines={1} color={theme.colors.text} style={styles.title}>
            {game.title}
          </ThemedText>
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <ThemedText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
                {game.genre}
              </ThemedText>
              <SlugText>{String(game.releaseYear)}</SlugText>
            </View>
            {isFreeGame(game) ? (
              <FreeTag />
            ) : game.priceMMK !== null ? (
              <SlugText color={theme.colors.text}>{formatKyat(game.priceMMK)}</SlugText>
            ) : null}
          </View>
        </PressableScale>
      );
    },
    [t, onPressGame],
  );

  return (
    <SectionRule>
      <SectionHeader eyebrow={t.arcade.discover.kicker} title={t.arcade.discover.title} />
      <FlatList
        data={ITEMS}
        keyExtractor={(item) => (item.kind === "game" ? item.game.id : `lane-${item.lane.id}`)}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.rail}
      />
    </SectionRule>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingHorizontal: theme.layout.screenPadding,
    gap: GAP,
  },
  card: { width: CARD_WIDTH },
  plate: { aspectRatio: 16 / 9 },
  badge: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
  },
  title: { marginTop: theme.spacing.sm },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  teaserContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
  },
});

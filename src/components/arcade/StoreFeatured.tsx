import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GamePlate } from "@/components/common/GamePlate";
import { PressableScale } from "@/components/ui/PressableScale";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ThemedText } from "@/components/ui/ThemedText";
import { ArcadeBadge } from "@/components/arcade/ArcadeBadge";
import { FreeTag } from "@/components/arcade/FreeTag";
import { SectionRule } from "@/components/arcade/SectionRule";
import { SlugText } from "@/components/arcade/SlugText";
import { featuredGames, isFreeGame } from "@/data/arcade";
import { PLATE_PALETTES, formatKyat, type Game } from "@/data/games";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

interface Props {
  onPressGame: () => void;
}

function FeaturedCard({ game, width, onPress }: { game: Game; width: number | "100%"; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={game.title}
      style={width === "100%" ? styles.cardFull : { width }}
    >
      <GamePlate palette={PLATE_PALETTES[game.id]} radius="xl" style={styles.plate}>
        {game.badge && <ArcadeBadge kind={game.badge} style={styles.badge} />}

        <View style={styles.overlay}>
          <View style={styles.titleColumn}>
            <ThemedText variant="body" weight="semibold" numberOfLines={1}>
              {game.title}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText variant="caption" color={theme.colors.textMuted}>
                {game.genre}
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textFaint}>
                ·
              </ThemedText>
              <SlugText>{game.platforms.join(" · ")}</SlugText>
              {game.rating !== null && (
                <>
                  <Ionicons name="star" size={10} color={theme.colors.premium} />
                  <SlugText>{game.rating.toFixed(1)}</SlugText>
                </>
              )}
            </View>
          </View>

          {isFreeGame(game) ? (
            <FreeTag />
          ) : game.priceMMK !== null ? (
            <SlugText color={theme.colors.text}>{formatKyat(game.priceMMK)}</SlugText>
          ) : null}
        </View>
      </GamePlate>
    </PressableScale>
  );
}

/** The four-game featured shelf — stacked on phones, 2-up on wide screens. */
export function StoreFeatured({ onPressGame }: Props) {
  const { t } = useLanguage();
  const layout = useHomeLayout();

  const cardWidth: number | "100%" = layout.isWide
    ? (layout.width - layout.gutter * 2 - theme.spacing.md) / 2
    : "100%";

  return (
    <SectionRule>
      <SectionHeader eyebrow={t.arcade.featured.kicker} title={t.arcade.featured.title} />
      <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
        {featuredGames.map((game) => (
          <FeaturedCard key={game.id} game={game} width={cardWidth} onPress={onPressGame} />
        ))}
      </View>
    </SectionRule>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  cardFull: { width: "100%" },
  plate: { aspectRatio: 16 / 9 },
  badge: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  titleColumn: { flex: 1, gap: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
});
